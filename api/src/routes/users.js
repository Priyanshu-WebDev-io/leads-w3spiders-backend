const express = require('express');
const router = express.Router();
const { getUsers, updateUser, deleteUser, createUser } = require('../controllers/userController');
const { protect, checkPermission } = require('../middleware/authMiddleware');

router.use(protect);
router.use(checkPermission('manage_users'));

router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
