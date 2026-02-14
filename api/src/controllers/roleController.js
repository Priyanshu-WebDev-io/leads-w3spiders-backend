const PERMISSIONS = require('../config/permissions');
const Role = require('../models/Role');
const User = require('../models/User');

// @desc    Get all roles
// @route   GET /admin/roles
// @access  Private/ManageRoles
const getRoles = async (req, res) => {
    try {
        const roles = await Role.find({});
        res.json({ success: true, roles });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Get all available permissions
// @route   GET /admin/roles/permissions
// @access  Private/ManageRoles
const getPermissions = async (req, res) => {
    try {
        res.json({ success: true, permissions: PERMISSIONS });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Create a new role
// @route   POST /admin/roles
// @access  Private/ManageRoles
const createRole = async (req, res) => {
    try {
        const { name, permissions, description } = req.body;

        const roleExists = await Role.findOne({ name });
        if (roleExists) {
            return res.status(400).json({ success: false, error: 'Role already exists' });
        }

        // Validate permissions
        const validPermissionIds = PERMISSIONS.map(p => p.id);
        const invalidPerms = permissions.filter(p => !validPermissionIds.includes(p));
        if (invalidPerms.length > 0) {
            return res.status(400).json({ success: false, error: `Invalid permissions: ${invalidPerms.join(', ')}` });
        }

        const role = await Role.create({
            name,
            permissions,
            description
        });

        res.status(201).json({ success: true, role });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Update a role
// @route   PUT /admin/roles/:id
// @access  Private/ManageRoles
const updateRole = async (req, res) => {
    try {
        const { name, permissions, description } = req.body;
        const role = await Role.findById(req.params.id);

        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        // Validate permissions
        if (permissions) {
            const validPermissionIds = PERMISSIONS.map(p => p.id);
            const invalidPerms = permissions.filter(p => !validPermissionIds.includes(p));
            if (invalidPerms.length > 0) {
                return res.status(400).json({ success: false, error: `Invalid permissions: ${invalidPerms.join(', ')}` });
            }
        }

        // Default Role Protection Logic
        if (role.isDefault) {
            // Only Super Admin or maybe 'admin' can touch default roles?
            // For now, let's assume anyone with 'manage_roles' can touch them IF allowed by below logic.
            // But usually you want stricter control.

            // 1. Cannot rename default roles
            if (name && name !== role.name) {
                return res.status(400).json({ success: false, error: 'Cannot rename default system roles' });
            }

            // 2. Protect Super Admin critical permission
            if (role.name === 'Super Admin' && permissions && !permissions.includes('manage_roles')) {
                return res.status(400).json({ success: false, error: 'Super Admin must have manage_roles permission' });
            }
        } else {
            role.name = name || role.name;
        }

        role.permissions = permissions || role.permissions;
        role.description = description || role.description;

        const updatedRole = await role.save();
        res.json({ success: true, role: updatedRole });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Delete a role
// @route   DELETE /admin/roles/:id
// @access  Private/ManageRoles
const deleteRole = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);

        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        if (role.isDefault) {
            return res.status(400).json({ success: false, error: 'Cannot delete default system roles' });
        }

        // Check if users are assigned to this role
        const usersCount = await User.countDocuments({ role: role._id });
        if (usersCount > 0) {
            return res.status(400).json({ success: false, error: `Cannot delete role. ${usersCount} users are assigned to it.` });
        }

        await role.deleteOne();
        res.json({ success: true, message: 'Role removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

module.exports = { getRoles, getPermissions, createRole, updateRole, deleteRole };
