const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password').populate('role');

            if (!req.user) {
                return res.status(401).json({ success: false, error: 'User not found' });
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ success: false, error: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ success: false, error: 'Not authorized, no token' });
    }
};

// Deprecated: Use checkPermission instead
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user.role || !roles.includes(req.user.role.name)) {
            return res.status(403).json({
                success: false,
                error: `User role ${req.user.role ? req.user.role.name : 'Unknown'} is not authorized to access this route`
            });
        }
        next();
    };
};

const checkPermission = (permission) => {
    return (req, res, next) => {
        // Super Admin has all permissions
        if (req.user.role && req.user.role.name === 'Super Admin') {
            return next();
        }

        if (!req.user.role || !req.user.role.permissions || !req.user.role.permissions.includes(permission)) {
            return res.status(403).json({
                success: false,
                error: `Permission denied: ${permission}`
            });
        }
        next();
    };
};

module.exports = { protect, authorize, checkPermission };
