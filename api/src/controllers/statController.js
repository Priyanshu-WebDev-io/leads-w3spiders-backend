const Job = require('../models/Job');
const Business = require('../models/Business');
const deduplicator = require('../services/deduplicator');
const logger = require('../utils/logger');

// @desc    Get system statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
const getStats = async (req, res) => {
    try {
        // Role-Based Filter
        const filter = {};
        if (req.user.role && req.user.role.name !== 'Super Admin') {
            filter.createdBy = req.user._id;
        }

        const totalJobs = await Job.countDocuments(filter);
        const completedJobs = await Job.countDocuments({ ...filter, status: 'completed' });
        const failedJobs = await Job.countDocuments({ ...filter, status: 'failed' });
        const runningJobs = await Job.countDocuments({ ...filter, status: 'running' });

        // Deduplication stats might be global? Or per user? 
        // For now, let's keep deduplicator global but maybe we can't easily filter it without changing the service.
        // Let's assume dedup stats are system-wide for now as they are about the efficacy of the system.
        const dedupStats = await deduplicator.getDuplicateStats();

        // CRM Stats
        const statusStats = await Business.aggregate([
            { $match: filter },
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        const crmStats = {
            new: 0,
            interested: 0,
            converted: 0,
            closed: 0
        };

        statusStats.forEach(s => {
            if (s._id) crmStats[s._id] = s.count;
        });

        const recentJobs = await Job.find(filter)
            .sort({ createdAt: -1 })
            .limit(5)
            .select('job_id status queries results_count new_businesses updated_businesses created_at');

        res.json({
            success: true,
            stats: {
                jobs: {
                    total: totalJobs,
                    completed: completedJobs,
                    failed: failedJobs,
                    running: runningJobs
                },
                businesses: dedupStats,
                crm: crmStats,
                schedules: {
                    active: await require('../models/Schedule').countDocuments({ ...filter, is_active: true }),
                    total: await require('../models/Schedule').countDocuments(filter)
                },
                sources: {
                    google_places: await Business.countDocuments({ ...filter, 'sources.type': 'google_places' }),
                    scraper: await Business.countDocuments({ ...filter, 'sources.type': 'scraper' }),
                    mixed: await Business.countDocuments({ ...filter, 'sources.1': { $exists: true } })
                },
                recent_jobs: recentJobs
            }
        });

    } catch (error) {
        logger.error(`Failed to fetch stats: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = {
    getStats
};
