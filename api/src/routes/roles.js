const express = require('express');
const router = express.Router();
const { getRoles, getPermissions, createRole, updateRole, deleteRole } = require('../controllers/roleController');
const { protect, checkPermission } = require('../middleware/authMiddleware');

router.use(protect);
router.use(checkPermission('manage_roles'));

router.get('/', getRoles);
router.get('/permissions', getPermissions);
router.post('/', createRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

module.exports = router;
