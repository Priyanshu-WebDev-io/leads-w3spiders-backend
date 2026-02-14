const express = require('express');
const router = express.Router();
const { getLogs } = require('../controllers/logController');
const { protect, checkPermission } = require('../middleware/authMiddleware');

// @desc    Get job logs (role-based)
// @route   GET /api/logs
// @access  Private/Admin
router.get('/', protect, checkPermission('view_logs'), getLogs);

module.exports = router;
