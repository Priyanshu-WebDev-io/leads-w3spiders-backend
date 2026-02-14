const cron = require('node-cron');
const logger = require('../utils/logger');
const scraperService = require('./scraper');
const processorService = require('./processor');
const Job = require('../models/Job');
const Schedule = require('../models/Schedule');
const Settings = require('../models/Settings');
const { v4: uuidv4 } = require('uuid');
const queryValidator = require('./queryValidator');

class SchedulerService {
    constructor() {
        this.activeTasks = new Map(); // scheduleId -> cronTask
        this.oneTimeTimers = new Map(); // scheduleId -> timeoutId
        this.isStarted = false;
    }

    /**
     * Start the scheduler
     */
    async start() {
        if (this.isStarted) return;

        logger.info('Starting Scheduler Service...');
        this.isStarted = true;

        // Load all active schedules
        try {
            const schedules = await Schedule.find({ is_active: true });
            logger.info(`Found ${schedules.length} active schedules`);

            for (const schedule of schedules) {
                this.scheduleJob(schedule);
            }
        } catch (error) {
            logger.error(`Failed to load schedules: ${error.message}`);
        }
    }

    /**
     * Stop the scheduler
     */
    stop() {
        logger.info('Stopping Scheduler Service...');
        this.isStarted = false;

        // Stop all cron tasks
        for (const [id, task] of this.activeTasks) {
            task.stop();
        }
        this.activeTasks.clear();

        // Clear all timers
        for (const [id, timer] of this.oneTimeTimers) {
            clearTimeout(timer);
        }
        this.oneTimeTimers.clear();
    }

    /**
     * Schedule a single job
     */
    scheduleJob(schedule) {
        // If already scheduled, remove first
        this.removeSchedule(schedule._id.toString());

        if (!schedule.is_active) return;

        try {
            if (schedule.type === 'recurring') {
                if (!cron.validate(schedule.cron_expression)) {
                    logger.warn(`Invalid cron expression for schedule ${schedule.name}`);
                    return;
                }

                const task = cron.schedule(schedule.cron_expression, () => {
                    this.executeScheduledScrape(schedule);
                });

                this.activeTasks.set(schedule._id.toString(), task);
                logger.info(`Scheduled recurring job: ${schedule.name} (${schedule.cron_expression})`);

            } else if (schedule.type === 'one-time') {
                const now = new Date();
                const scheduledTime = new Date(schedule.scheduled_time);

                if (scheduledTime <= now) {
                    // Check if it was missed by a lot or just restart?
                    // Verify status? Usually we only run if status is 'pending' or we just run it if slight delay?
                    // If it's in the past, maybe we should just run it immediately IF it hasn't run yet?
                    // But for safety, let's just log warning or run if within 5 mins?

                    // Simple logic: If it is active and one-time and not completed, run it.
                    const delay = scheduledTime.getTime() - now.getTime();
                    if (delay <= 0) {
                        logger.info(`One-time job ${schedule.name} is past due, running immediately`);
                        this.runScheduleNow(schedule._id);
                    } else {
                        logger.info(`Scheduled one-time job: ${schedule.name} in ${Math.ceil(delay / 1000)}s`);
                        const timer = setTimeout(() => {
                            this.runScheduleNow(schedule._id);
                        }, delay);
                        this.oneTimeTimers.set(schedule._id.toString(), timer);
                    }
                } else {
                    const delay = scheduledTime.getTime() - now.getTime();
                    // Limit delay to sensible max (e.g. 24 days is setTimeout max)
                    if (delay > 2147483647) {
                        logger.warn(`One-time job ${schedule.name} is too far in future`);
                        return;
                    }

                    logger.info(`Scheduled one-time job: ${schedule.name} in ${Math.ceil(delay / 1000)}s`);
                    const timer = setTimeout(() => {
                        this.runScheduleNow(schedule._id);
                    }, delay);
                    this.oneTimeTimers.set(schedule._id.toString(), timer);
                }
            }
        } catch (error) {
            logger.error(`Failed to schedule job ${schedule.name}: ${error.message}`);
        }
    }

    /**
     * Remove/Stop a schedule
     */
    removeSchedule(scheduleId) {
        if (this.activeTasks.has(scheduleId)) {
            this.activeTasks.get(scheduleId).stop();
            this.activeTasks.delete(scheduleId);
        }
        if (this.oneTimeTimers.has(scheduleId)) {
            clearTimeout(this.oneTimeTimers.get(scheduleId));
            this.oneTimeTimers.delete(scheduleId);
        }
    }

    // Helper to mark one-time as inactive
    async markOneTimeAsCompleted(scheduleId) {
        await Schedule.findByIdAndUpdate(scheduleId, { is_active: false });
    }
    /**
     * Manual trigger
     */
    async runScheduleNow(scheduleId) {
        // ... (keep existing implementation)
        try {
            const schedule = await Schedule.findById(scheduleId);
            if (!schedule) {
                throw new Error('Schedule not found');
            }
            logger.info(`Manual execution triggered for schedule: ${schedule.name}`);

            if (schedule.type === 'one-time') {
                this.removeSchedule(scheduleId);
                await this.executeScheduledScrape(schedule);
                await this.markOneTimeAsCompleted(scheduleId);
            } else {
                await this.executeScheduledScrape(schedule);
            }

            return { success: true };
        } catch (error) {
            logger.error(`Failed to run schedule ${scheduleId} now: ${error.message}`);
            throw error;
        }
    }


    /**
     * Execute a specific schedule
     */
    async executeScheduledScrape(schedule) {
        logger.info(`Executing scheduled task: ${schedule.name}`);

        try {
            // Update last run time
            await Schedule.findByIdAndUpdate(schedule._id, { last_run: new Date() });


            // Fetch global settings
            let settings = await Settings.findOne({ key: 'global' });
            if (!settings) settings = {};

            // Merge config - Ensure we keep all user configs like provider, force_scrape
            const userConfig = schedule.config || {};
            const config = {
                ...userConfig, // Spread user config first (contains provider, fields_level, force_scrape)
                max_results: userConfig.max_results || settings.default_max_results || 70,
                depth: userConfig.depth || Math.ceil((userConfig.max_results || settings.default_max_results || 70) / 10),
                email_extraction: userConfig.email_extraction ?? settings.email_extraction_enabled ?? false
            };

            const queries = schedule.queries;
            if (!queries || queries.length === 0) {
                logger.warn(`No queries for schedule ${schedule.name}`);
                return;
            }

            // Deduplication Check (Runtime)
            let finalQueries = queries.map(q => q.trim().toLowerCase());
            let skippedCount = 0;
            const provider = config.provider || 'google_places';
            const forceScrape = config.force_scrape || false;

            if (!forceScrape) {
                const result = await queryValidator.checkDuplicates(queries, provider);
                finalQueries = result.uniqueQueries;
                skippedCount = result.skippedCount;

                if (finalQueries.length === 0) {
                    logger.info(`Skipping schedule ${schedule.name}: All queries are duplicates and force_scrape is false.`);
                    return;
                }
            }

            // Prepare Job Data
            const jobId = uuidv4();
            const jobData = {
                job_id: jobId,
                queries: finalQueries,
                triggered_by: 'scheduler',
                config: {
                    ...config,
                    original_query_count: queries.length,
                    skipped_count: skippedCount
                },
                metadata: schedule.metadata
            };

            // Log Queries
            // Jobs are automatically logged when created

            // Add to Queue (Replaces local execution logic)
            // We need to require jobQueue dynamically to avoid circular issues or just at top if fine.
            // But scheduler is singleton.
            const jobQueue = require('./jobQueue');
            await jobQueue.addJob(jobData);

            logger.info(`Schedule ${schedule.name} triggered job ${jobId} (Queued)`);

        } catch (error) {
            logger.error(`Schedule ${schedule.name} failed to queue job: ${error.message}`);
        }
    }
}

module.exports = new SchedulerService();
