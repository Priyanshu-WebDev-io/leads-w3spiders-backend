const GooglePlaceRaw = require('../models/GooglePlaceRaw');
const ScraperRaw = require('../models/ScraperRaw');
const Job = require('../models/Job');

// @desc    Fetch raw Google Places API data
// @route   GET /api/admin/raw/google
// @access  Private/Admin
const getGoogleRaw = async (req, res) => {
    try {
        const { limit = 1000, skip = 0, job_id } = req.query;
        const filter = {};

        // Role-based filtering
        const isSuperAdmin = req.user.role?.name === 'Super Admin';

        if (!isSuperAdmin) {
            // Regular users: only show their own data
            // Find all jobs created by this user and get their job_id strings
            const userJobs = await Job.find({ createdBy: req.user._id }).select('job_id');
            const userJobIds = userJobs.map(job => job.job_id);

            if (userJobIds.length === 0) {
                return res.json({ success: true, count: 0, total: 0, data: [] });
            }

            filter.job_id = { $in: userJobIds };
        }

        if (job_id) {
            filter.job_id = job_id;
        }

        const data = await GooglePlaceRaw.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await GooglePlaceRaw.countDocuments(filter);

        res.json({ success: true, count: data.length, total, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Fetch raw Scraper data
// @route   GET /api/admin/raw/scraper
// @access  Private/Admin
const getScraperRaw = async (req, res) => {
    try {
        const { limit = 1000, skip = 0, job_id } = req.query;
        const filter = {};

        // Role-based filtering
        const isSuperAdmin = req.user.role?.name === 'Super Admin';

        if (!isSuperAdmin) {
            // Regular users: only show their own data
            // Find all jobs created by this user and get their job_id strings
            const userJobs = await Job.find({ createdBy: req.user._id }).select('job_id');
            const userJobIds = userJobs.map(job => job.job_id);

            if (userJobIds.length === 0) {
                return res.json({ success: true, count: 0, total: 0, data: [] });
            }

            filter.job_id = { $in: userJobIds };
        }

        if (job_id) {
            filter.job_id = job_id;
        }

        const data = await ScraperRaw.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await ScraperRaw.countDocuments(filter);

        res.json({ success: true, count: data.length, total, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getGoogleRaw,
    getScraperRaw
};
