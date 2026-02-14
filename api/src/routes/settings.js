const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingController');
const { protect, checkPermission } = require('../middleware/authMiddleware');

// GET /settings - Get global settings
router.get('/', protect, checkPermission('manage_settings'), getSettings);

// PUT /settings - Update global settings
router.put('/', protect, checkPermission('manage_settings'), updateSettings);

module.exports = router;
