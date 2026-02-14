
const { v4: uuidv4 } = require('uuid');
const Job = require('../models/Job');
const logger = require('../utils/logger');
const queryValidator = require('../services/queryValidator');
const jobQueue = require('../services/jobQueue');

// @desc    Trigger a manual scrape
// @route   POST /api/admin/scrape/start
// @access  Private/Admin
const startScrape = async (req, res) => {
    try {
        const { queries, provider, fields_level, max_pages, max_results, force_scrape, ...otherConfig } = req.body;

        if (!queries || !Array.isArray(queries) || queries.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Queries array is required and must not be empty'
            });
        }

        let finalQueries = queries.map(q => q.trim().toLowerCase()).filter(q => q.length > 0);
        let skippedCount = 0;

        // Deduplication Check
        if (!force_scrape) {
            // 1. Check against RUNNING/QUEUED/SCHEDULED (Active Conflicts)
            const activeConflicts = await queryValidator.checkActiveConflicts(queries);
            finalQueries = activeConflicts.uniqueQueries;

            if (activeConflicts.conflictCount > 0) {
                logger.info(`Skipped ${activeConflicts.conflictCount} queries because they are already running or scheduled.`);
            }

            if (finalQueries.length === 0) {
                return res.json({
                    success: false,
                    skipped: true,
                    message: `All queries are currently running or scheduled. Please wait for them to finish.`
                });
            }

            // 2. Check against HISTORY (Completed Logs)
            const result = await queryValidator.checkDuplicates(finalQueries, provider);
            finalQueries = result.uniqueQueries;
            skippedCount = result.skippedCount + activeConflicts.conflictCount;

            if (finalQueries.length === 0) {
                return res.json({
                    success: false,
                    skipped: true,
                    message: `All ${queries.length} queries check out as duplicates (Historical or Active). Use "Reprocess Duplicates" to bypass.`
                });
            }
        }

        // Prepare Job Data
        const jobId = uuidv4();
        const jobData = {
            job_id: jobId,
            queries: finalQueries,
            triggered_by: 'admin', // Kept for backward compatibility, but createdBy is better
            createdBy: req.user._id, // Track ownership
            config: {
                ...otherConfig, // Capture concurrency, proxies, etc.
                max_results: parseInt(max_results) || parseInt(process.env.MAX_RESULTS) || 70,
                max_pages: parseInt(max_pages),
                provider: provider,
                fields_level: fields_level,
                force_scrape: force_scrape,

                depth: Math.ceil((parseInt(max_results || process.env.MAX_RESULTS) || 70) / 10),
                email_extraction: false,
                original_query_count: queries.length,
                skipped_count: skippedCount,
                strict_mode: otherConfig.strict_mode || false,
                fallback_to_scraper: otherConfig.strict_mode ? false : (otherConfig.fallback_to_scraper !== undefined ? otherConfig.fallback_to_scraper : true)
            }
        };

        // Jobs are automatically logged when created (no need for separate QueryLog)

        logger.info(`User ${req.user.name} (${req.user.role}) submitted scrape job: ${jobId}`, { queries: finalQueries });

        // Add to Queue (it will save the job and trigger processing)
        await jobQueue.addJob(jobData);

        res.json({
            success: true,
            job_id: jobId,
            status: 'pending',
            message: skippedCount > 0
                ? `Job queued with ${finalQueries.length} new queries (${skippedCount} duplicates skipped)`
                : `Job queued with ${finalQueries.length} queries`,
            queries: finalQueries,
            queue_position: 'pending' // Simplified for now
        });

    } catch (error) {
        logger.error(`Failed to start scrape: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get all jobs with filtering and pagination
// @route   GET /api/admin/jobs
// @access  Private/Admin
const getJobs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            search,
            userId // Filter by specific user (for Super Admin)
        } = req.query;

        const filter = {};

        // Role-based filtering
        const roleName = req.user.role?.name || '';

        // Super Admin can see all jobs, optionally filtered by userId
        if (roleName === 'Super Admin') {
            if (userId) {
                filter.createdBy = userId;
            }
        } else {
            // Other users only see their own jobs
            filter.createdBy = req.user._id;
        }

        // Status filter
        if (status) {
            filter.status = status;
        }

        // Search filter - search in job_id and queries array
        if (search) {
            filter.$or = [
                { job_id: { $regex: search, $options: 'i' } },
                { queries: { $elemMatch: { $regex: search, $options: 'i' } } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const jobs = await Job.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('createdBy', 'username email');

        const total = await Job.countDocuments(filter);

        res.json({
            success: true,
            count: jobs.length,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            jobs
        });

    } catch (error) {
        logger.error(`Failed to fetch jobs: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get job details
// @route   GET /api/admin/jobs/:id
// @access  Private/Admin
const getJobById = async (req, res) => {
    try {
        const job = await Job.findOne({ job_id: req.params.id });

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }

        res.json({
            success: true,
            job: job
        });

    } catch (error) {
        logger.error(`Failed to fetch job: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = {
    startScrape,
    getJobs,
    getJobById
};
