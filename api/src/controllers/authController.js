const User = require('../models/User');
const Role = require('../models/Role');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username }).populate('role');

        if (user && (await user.matchPassword(password))) {
            if (user.isActive === false) {
                return res.status(401).json({ success: false, error: 'Account is deactivated' });
            }

            res.json({
                success: true,
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role, // Now populated object
                    token: generateToken(user._id),
                }
            });
        } else {
            res.status(401).json({ success: false, error: 'Invalid start credentials' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('role');

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.status(200).json({
            success: true,
            user: {
                _id: user._id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

module.exports = { loginUser, getMe };
