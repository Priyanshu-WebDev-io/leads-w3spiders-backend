const Business = require('../models/Business');
const logger = require('../utils/logger');

// @desc    Get dashboard statistics
// @route   GET /api/admin/businesses/stats
// @access  Private
const getDashboardStats = async (req, res) => {
    try {
        const isSuperAdmin = req.user.role && req.user.role.name === 'Super Admin';
        const userId = req.user._id;

        // Date ranges
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let stats = {};

        if (isSuperAdmin) {
            // GLOBAL STATS FOR SUPER ADMIN

            // Total businesses
            const totalBusinesses = await Business.countDocuments();

            // Today's stats
            const todayBusinesses = await Business.countDocuments({
                first_seen: { $gte: todayStart }
            });

            // This month's stats
            const monthBusinesses = await Business.countDocuments({
                first_seen: { $gte: monthStart }
            });

            // Contact info breakdown
            const withEmail = await Business.countDocuments({
                emails: { $exists: true, $ne: [] }
            });
            const withPhone = await Business.countDocuments({
                phone: { $exists: true, $ne: '' }
            });
            const withWebsite = await Business.countDocuments({
                website: { $exists: true, $ne: null, $ne: '' }
            });

            // Status breakdown
            const statusBreakdown = await Business.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Top categories
            const topCategories = await Business.aggregate([
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]);

            // Top contributors (users)
            const topContributors = await Business.aggregate([
                {
                    $match: {
                        createdBy: { $exists: true, $ne: null }
                    }
                },
                {
                    $group: {
                        _id: '$createdBy',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $project: {
                        username: '$user.username',
                        count: 1
                    }
                }
            ]);

            stats = {
                type: 'global',
                total: {
                    businesses: totalBusinesses,
                    withEmail,
                    withPhone,
                    withWebsite
                },
                today: {
                    businesses: todayBusinesses
                },
                month: {
                    businesses: monthBusinesses
                },
                breakdown: {
                    status: statusBreakdown.reduce((acc, item) => {
                        acc[item._id || 'unfiltered'] = item.count;
                        return acc;
                    }, {}),
                    topCategories: topCategories.map(c => ({
                        category: c._id || 'Unknown',
                        count: c.count
                    })),
                    topContributors: topContributors.map(c => ({
                        username: c.username,
                        count: c.count
                    }))
                }
            };

        } else {
            // USER-SPECIFIC CONTRIBUTION STATS

            // Total contribution
            const totalContribution = await Business.countDocuments({
                createdBy: userId
            });

            // Global total for percentage
            const globalTotal = await Business.countDocuments();

            // Today's contribution
            const todayContribution = await Business.countDocuments({
                createdBy: userId,
                first_seen: { $gte: todayStart }
            });

            // This month's contribution
            const monthContribution = await Business.countDocuments({
                createdBy: userId,
                first_seen: { $gte: monthStart }
            });

            // Contact info breakdown (user's data)
            const withEmail = await Business.countDocuments({
                createdBy: userId,
                emails: { $exists: true, $ne: [] }
            });
            const withPhone = await Business.countDocuments({
                createdBy: userId,
                phone: { $exists: true, $ne: '' }
            });
            const withWebsite = await Business.countDocuments({
                createdBy: userId,
                website: { $exists: true, $ne: null, $ne: '' }
            });

            // Status breakdown (user's data)
            const statusBreakdown = await Business.aggregate([
                { $match: { createdBy: userId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Top categories (user's data)
            const topCategories = await Business.aggregate([
                { $match: { createdBy: userId } },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]);

            stats = {
                type: 'personal',
                contribution: {
                    total: totalContribution,
                    percentage: globalTotal > 0 ? ((totalContribution / globalTotal) * 100).toFixed(2) : 0,
                    globalTotal
                },
                today: {
                    businesses: todayContribution
                },
                month: {
                    businesses: monthContribution
                },
                contactInfo: {
                    withEmail,
                    withPhone,
                    withWebsite
                },
                breakdown: {
                    status: statusBreakdown.reduce((acc, item) => {
                        acc[item._id || 'unfiltered'] = item.count;
                        return acc;
                    }, {}),
                    topCategories: topCategories.map(c => ({
                        category: c._id || 'Unknown',
                        count: c.count
                    }))
                }
            };
        }

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        logger.error(`Failed to fetch dashboard stats: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Search businesses
// @route   GET /api/admin/businesses
// @access  Private/Admin
const getBusinesses = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            search,
            category,
            has_email,
            has_website,
            has_phone,
            min_rating,
            city,
            state,
            source,
            ownerId // Admin can filter by specific user
        } = req.query;

        const filter = {};

        // Role-Based Access Control
        // REVISED (Claim Workflow):
        // 1. 'new' status -> Publicly visible (Company Data).
        // 2. Other statuses -> Private to Owner (My Data).

        if (req.user.role && req.user.role.name !== 'Super Admin') {
            // If checking 'new', allow global access (unless specific owner requested below)
            // If checking anything else (or no status), force own data
            if (req.query.status !== 'new') {
                filter.createdBy = req.user._id;
            }
        }

        if (ownerId) {
            filter.createdBy = ownerId;
        }

        if (search) {
            filter.$text = { $search: search };
        }

        if (category) {
            filter.category = new RegExp(category, 'i');
        }

        if (has_email === 'true') {
            filter.emails = { $exists: true, $ne: [] };
        }

        if (has_phone === 'true') {
            filter.phone = { $exists: true, $ne: '' };
        }

        if (has_website === 'true') {
            filter.website = { $exists: true, $ne: null, $ne: '' };
        } else if (has_website === 'false') {
            filter.$or = [
                { website: { $exists: false } },
                { website: null },
                { website: '' }
            ];
        }

        // Min Rating Filter
        if (min_rating) {
            filter.rating = { $gte: parseFloat(min_rating) };
        }

        // City Filter
        if (city) {
            filter.city = new RegExp(city, 'i');
        }

        // State Filter
        if (state) {
            filter.state = new RegExp(state, 'i');
        }

        // Source Filter
        if (source) {
            filter['sources.type'] = source;
        }

        if (req.query.status) {
            if (req.query.status === 'new') {
                filter.$or = [
                    { status: 'new' },
                    { status: { $exists: false } },
                    { status: null },
                    { status: '' }
                ];
            } else {
                filter.status = req.query.status;
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const businesses = await Business.find(filter)
            .populate('createdBy', 'username email')
            .sort({ last_updated: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Business.countDocuments(filter);

        res.json({
            success: true,
            count: businesses.length,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            businesses
        });

    } catch (error) {
        logger.error(`Failed to fetch businesses: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Update business details (status, remarks)
// @route   PUT /api/admin/businesses/:id
// @access  Private/Admin
const updateBusiness = async (req, res) => {
    try {
        const { status, remarks } = req.body;
        const update = {};

        if (status) {
            const allowedStatuses = ['new', 'interested', 'converted', 'closed', 'rejected'];
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({ success: false, error: 'Invalid status' });
            }
            update.status = status;
        }

        if (remarks !== undefined) {
            update.remarks = remarks;
        }

        const business = await Business.findById(req.params.id);

        if (!business) {
            return res.status(404).json({ success: false, error: 'Business not found' });
        }

        // Check Write Permissions
        // Super Admin can edit anything.
        // Users can edit their own.
        // Users can also edit 'new' leads (Claiming them).

        const isSuperAdmin = req.user.role.name === 'Super Admin';
        const isOwner = business.createdBy && business.createdBy.toString() === req.user._id.toString();
        const isClaimable = business.status === 'new';

        if (!isSuperAdmin && !isOwner && !isClaimable) {
            return res.status(403).json({ success: false, error: 'Not authorized to update this business' });
        }

        // Auto-Claim Logic: If taking a 'new' lead, assign to self
        if (!isSuperAdmin && !isOwner && isClaimable) {
            // Only claim if status is actually changing from 'new'
            if (update.status && update.status !== 'new') {
                business.createdBy = req.user._id;
            }
        }

        // Apply updates
        if (update.status) business.status = update.status;
        if (update.remarks) business.remarks = update.remarks;

        await business.save();

        res.json({ success: true, business });
    } catch (error) {
        logger.error(`Failed to update business: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getDashboardStats,
    getBusinesses,
    updateBusiness
};
