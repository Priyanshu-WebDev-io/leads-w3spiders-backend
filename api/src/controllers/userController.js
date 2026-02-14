const User = require('../models/User');
const Role = require('../models/Role');

// @desc    Get all users
// @route   GET /admin/users
// @access  Private/Admin
const getUsers = async (req, res) => {
    try {
        const users = await User.find({})
            .select('-password')
            .populate('role')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Create user
// @route   POST /admin/users
// @access  Private/Admin
const createUser = async (req, res) => {
    try {
        const { username, password, role, email, isActive } = req.body;

        if (!username || !password || !role) {
            return res.status(400).json({
                success: false,
                error: 'Please provide username, password and role'
            });
        }

        // Check if user exists
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({
                success: false,
                error: 'User already exists'
            });
        }

        // Validate role exists
        const roleDoc = await Role.findById(role);
        if (!roleDoc) {
            return res.status(400).json({
                success: false,
                error: 'Invalid role'
            });
        }

        const user = await User.create({
            username,
            password,
            role: role,
            email,
            isActive: isActive !== undefined ? isActive : true
        });

        res.status(201).json({
            success: true,
            user: {
                _id: user._id,
                username: user.username,
                role: roleDoc,
                email: user.email,
                isActive: user.isActive
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

// @desc    Update user
// @route   PUT /admin/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
    try {
        const { username, email, role, isActive, password } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.username = username || user.username;
        user.email = email !== undefined ? email : user.email; // Allow clearing or setting

        if (role) {
            user.role = role;
        }

        if (isActive !== undefined) {
            user.isActive = isActive;
        }

        if (password) {
            user.password = password;
        }

        const updatedUser = await user.save();

        // Re-populate role for response
        await updatedUser.populate('role');

        res.status(200).json({
            success: true,
            user: {
                _id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
                isActive: updatedUser.isActive
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Delete user
// @route   DELETE /admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (user.role && user.role.name === 'Super Admin' && user._id.equals(req.user._id)) {
            return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
        }

        await user.deleteOne();
        res.status(200).json({ success: true, message: 'User removed' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
