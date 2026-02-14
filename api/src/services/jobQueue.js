const Job = require('../models/Job');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');

// Moved execution logic here from jobController
// This service acts as the Processor

const scraperService = require('./scraper');
const processorService = require('./processor');

class JobQueue {
    constructor() {
        this.isProcessing = false;
        this.defaultConcurrency = 2; // Default limit
    }

    /**
     * Initialize the queue service
     * Resets any jobs stuck in 'running' state from previous crashes
     */
    async init() {
        try {
            const stuckJobs = await Job.updateMany(
                { status: 'running' },
                {
                    $set: {
                        status: 'failed',
                        error_message: 'Job failed due to server restart/crash'
                    }
                }
            );

            if (stuckJobs.modifiedCount > 0) {
                logger.info(`Queue Init: Reset ${stuckJobs.modifiedCount} stuck jobs to failed.`);
            } else {
                logger.info('Queue Init: Clean start, no stuck jobs.');
            }

            // Resume processing if there are pending jobs
            this.processQueue();
        } catch (error) {
            logger.error(`Queue Init Failed: ${error.message}`);
        }
    }

    /**
     * Add a job to the queue
     * @param {Object} jobData - Data to create a Job document
     * @returns {Promise<Object>} - Created Job
     */
    async addJob(jobData) {
        try {
            // Create the job with 'pending' status
            const job = new Job({
                ...jobData,
                status: 'pending'
            });
            await job.save();

            logger.info(`Job ${job.job_id} added to queue.`);

            // Trigger processing
            this.processQueue();

            return job;
        } catch (error) {
            logger.error(`Failed to add job to queue: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process the queue
     */
    async processQueue() {
        if (this.isProcessing) return; // Simple lock (mostly for single instance)
        this.isProcessing = true;

        try {
            // Get settings for concurrency
            let settings = await Settings.findOne({ key: 'global' });
            if (!settings) settings = {};
            const concurrencyLimit = settings.max_concurrent_jobs || this.defaultConcurrency;

            // Check how many are running
            const runningCount = await Job.countDocuments({ status: 'running' });

            if (runningCount >= concurrencyLimit) {
                logger.info(`Queue paused: ${runningCount}/${concurrencyLimit} jobs running.`);
                this.isProcessing = false;
                return;
            }

            const slotsAvailable = concurrencyLimit - runningCount;

            // Get next pending jobs
            const pendingJobs = await Job.find({ status: 'pending' })
                .sort({ createdAt: 1 }) // FIFO
                .limit(slotsAvailable);

            if (pendingJobs.length === 0) {
                this.isProcessing = false;
                return;
            }

            logger.info(`Processing ${pendingJobs.length} jobs from queue...`);

            // Process each job (in parallel up to slots)
            const promises = pendingJobs.map(job => this.executeJob(job));

            // We don't await all of them to block, but we want to know when they are "started"
            // Actually, we should just fire and forget them? No, we need to track them.
            // But processQueue is async.

            await Promise.allSettled(promises);

            // Check if more jobs can be run (in case one finished super fast or we have more slots)
            this.processQueue();

        } catch (error) {
            logger.error(`Queue processing error: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Execute a single job (The logic moved from controller)
     * @param {Object} job
     */
    async executeJob(job) {
        try {
            logger.info(`Starting job ${job.job_id} from queue`);

            job.status = 'running';
            job.started_at = new Date();
            await job.save();

            // Execute scraper
            const scrapeResult = await scraperService.executeScrape(job.queries, job.job_id, job.config || {});

            // Determine provider
            const provider = scrapeResult.provider || (job.config && job.config.provider) || 'google_places';

            // Process results
            const stats = await processorService.processOutput(
                scrapeResult.local_path,
                job.queries.join(', '),
                job.job_id,
                provider,
                job.createdBy // Pass user ID for ownership tracking
            );

            // Update job success
            job.status = 'completed';
            job.completed_at = new Date();
            job.duration_seconds = Math.floor((job.completed_at - job.started_at) / 1000);
            job.results_count = stats.total;
            job.new_businesses = stats.new;
            job.updated_businesses = stats.updated;

            if (scrapeResult.cloudinary_url) {
                job.cloudinary_url = scrapeResult.cloudinary_url;
                job.cloudinary_public_id = scrapeResult.cloudinary_public_id;
            }

            await job.save();

            // Cleanup
            if (process.env.CLEANUP_TEMP === 'true' && scrapeResult.local_path) {
                const path = require('path');
                const tempDir = path.dirname(scrapeResult.local_path);
                await scraperService.cleanupTempDir(tempDir);
            }

            logger.info(`Job ${job.job_id} completed successfully`);

        } catch (error) {
            logger.error(`Job ${job.job_id} failed: ${error.message}`);

            job.status = 'failed';
            job.completed_at = new Date();
            job.error_message = error.message;
            await job.save();
        } finally {
            // Trigger queue to check for next job
            // Using setImmediate to break stack
            setTimeout(() => this.processQueue(), 1000);
        }
    }
}

module.exports = new JobQueue();
