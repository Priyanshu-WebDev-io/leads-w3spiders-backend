const Schedule = require('../models/Schedule');
const schedulerService = require('../services/scheduler');
const logger = require('../utils/logger');
const queryValidator = require('../services/queryValidator');

// @desc    List all schedules
// @route   GET /api/schedules
// @access  Private/Admin
const getSchedules = async (req, res) => {
    try {
        const filter = {};
        // Role-based filtering
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            filter.createdBy = req.user._id;
        }

        const schedules = await Schedule.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, schedules });
    } catch (error) {
        logger.error(`Failed to fetch schedules: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Create new schedule
// @route   POST /api/schedules
// @access  Private/Admin
const createSchedule = async (req, res) => {
    try {
        const { name, queries, config, is_active, scheduled_time, metadata } = req.body;

        if (!queries || !Array.isArray(queries) || queries.length === 0) {
            return res.status(400).json({ success: false, error: 'Queries required' });
        }

        let finalQueries = queries.map(q => q.trim().toLowerCase());
        const provider = config?.provider || 'google_places';
        const forceScrape = config?.force_scrape || false;

        // Deduplication Check
        if (!forceScrape) {
            // 1. Check Active Conflicts
            const activeConflicts = await queryValidator.checkActiveConflicts(queries);
            finalQueries = activeConflicts.uniqueQueries;

            if (finalQueries.length === 0) {
                return res.json({
                    success: false,
                    skipped: true,
                    message: `All queries are already running or scheduled.`
                });
            }

            // 2. Check Historical Duplicates
            const result = await queryValidator.checkDuplicates(finalQueries, provider);
            finalQueries = result.uniqueQueries;

            if (finalQueries.length === 0) {
                return res.json({
                    success: false, // Not an error, just no work to do
                    skipped: true,
                    message: `All ${queries.length} queries check out as duplicates. Use "Reprocess Duplicates" to schedule anyway.`
                });
            }
        }

        const schedule = new Schedule({
            name,
            queries: finalQueries,
            config,
            is_active,
            type: 'one-time',
            scheduled_time,
            metadata,
            createdBy: req.user._id
        });

        await schedule.save();

        // Refresh scheduler if active
        if (schedule.is_active) {
            schedulerService.scheduleJob(schedule);
        }

        res.json({ success: true, schedule });
    } catch (error) {
        logger.error(`Failed to create schedule: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Update schedule
// @route   PUT /api/schedules/:id
// @access  Private/Admin
const updateSchedule = async (req, res) => {
    try {
        const { name, queries, config, is_active, scheduled_time, metadata } = req.body;

        // Verify Ownership
        const existingSchedule = await Schedule.findById(req.params.id);
        if (!existingSchedule) {
            return res.status(404).json({ success: false, error: 'Schedule not found' });
        }
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin' &&
            existingSchedule.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, error: 'Not authorized to update this schedule' });
        }

        let finalQueries = queries;
        if (queries && Array.isArray(queries) && queries.length > 0) {
            const provider = config?.provider || 'google_places';
            const forceScrape = config?.force_scrape || false;

            if (!forceScrape) {
                // 1. Check Active Conflicts
                const activeConflicts = await queryValidator.checkActiveConflicts(queries);
                finalQueries = activeConflicts.uniqueQueries;

                if (finalQueries.length === 0) {
                    return res.json({
                        success: false,
                        skipped: true,
                        message: `All queries are currently running or already scheduled.`
                    });
                }

                // 2. Check Historical
                const result = await queryValidator.checkDuplicates(finalQueries, provider);
                finalQueries = result.uniqueQueries;
                if (finalQueries.length === 0) {
                    return res.json({
                        success: false,
                        skipped: true,
                        message: `All queries are duplicates. Enable "Reprocess Duplicates" to save.`
                    });
                }
            }
        }

        const schedule = await Schedule.findByIdAndUpdate(
            req.params.id,
            { name, queries: finalQueries, config, is_active, scheduled_time, metadata },
            { new: true }
        );

        // Update scheduler
        if (schedule.is_active) {
            schedulerService.scheduleJob(schedule);
        } else {
            schedulerService.removeSchedule(schedule._id);
        }

        res.json({ success: true, schedule });
    } catch (error) {
        logger.error(`Failed to update schedule: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Run schedule immediately
// @route   POST /api/schedules/:id/run
// @access  Private/Admin
const runSchedule = async (req, res) => {
    try {
        // Verify Ownership
        const existingSchedule = await Schedule.findById(req.params.id);
        if (!existingSchedule) {
            return res.status(404).json({ success: false, error: 'Schedule not found' });
        }
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin' &&
            existingSchedule.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, error: 'Not authorized to run this schedule' });
        }

        await schedulerService.runScheduleNow(req.params.id);
        res.json({ success: true, message: 'Schedule execution triggered' });
    } catch (error) {
        logger.error(`Failed to run schedule: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Delete schedule
// @route   DELETE /api/schedules/:id
// @access  Private/Admin
const deleteSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.findById(req.params.id);

        if (!schedule) {
            return res.status(404).json({ success: false, error: 'Schedule not found' });
        }

        if (req.user.role !== 'admin' && req.user.role !== 'superadmin' &&
            schedule.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, error: 'Not authorized to delete this schedule' });
        }

        await Schedule.findByIdAndDelete(req.params.id);

        schedulerService.removeSchedule(schedule._id);
        res.json({ success: true, message: 'Schedule deleted' });
    } catch (error) {
        logger.error(`Failed to delete schedule: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getSchedules,
    createSchedule,
    updateSchedule,
    runSchedule,
    deleteSchedule
};
