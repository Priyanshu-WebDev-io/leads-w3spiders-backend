const Job = require('../models/Job');
const logger = require('../utils/logger');

// @desc    Get job logs with role-based filtering
// @route   GET /api/logs
// @access  Private/Admin
const getLogs = async (req, res) => {
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

        // Super Admin can see all logs, optionally filtered by userId
        if (roleName === 'Super Admin') {
            if (userId) {
                filter.createdBy = userId;
            }
        } else {
            // Other users only see their own logs
            filter.createdBy = req.user._id;
        }

        // Additional filters
        if (status) {
            filter.status = status;
        }

        if (search) {
            // Search in job_id or queries
            filter.$or = [
                { job_id: { $regex: search, $options: 'i' } },
                { 'config.query': { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const logs = await Job.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('createdBy', 'username email');

        const total = await Job.countDocuments(filter);

        res.json({
            success: true,
            count: logs.length,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            jobs: logs // Keep as 'jobs' for consistency with other endpoints
        });
    } catch (error) {
        logger.error(`Failed to fetch logs: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getLogs
};
