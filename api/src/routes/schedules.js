const express = require('express');
const router = express.Router();
const {
    getSchedules,
    createSchedule,
    updateSchedule,
    runSchedule,
    deleteSchedule
} = require('../controllers/scheduleController');
const { protect, checkPermission } = require('../middleware/authMiddleware');

// Apply protection and permission check
router.use(protect);
router.use(checkPermission('manage_schedules'));

// GET /schedules - List all schedules
router.get('/', getSchedules);

// POST /schedules - Create new schedule
router.post('/', createSchedule);

// PUT /schedules/:id - Update schedule
router.put('/:id', updateSchedule);

// POST /schedules/:id/run - Run schedule immediately
router.post('/:id/run', runSchedule);

// DELETE /schedules/:id - Delete schedule
router.delete('/:id', deleteSchedule);

module.exports = router;
