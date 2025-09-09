const express = require('express');
const router = express.Router();
const supportController = require('../controllers/support.controller');
const { verifyToken } = require('../middlewares/authorization');
const { isAdmin } = require('../middlewares/isAdmin');

// Create a new support ticket
router.post('/', verifyToken, supportController.createSupport);

// Get all support tickets (admin only)
router.get('/all', verifyToken, isAdmin, supportController.getAllSupports);

// Get user's support tickets
router.get('/user/:email', verifyToken, supportController.getUserSupports);

// Update support ticket status (admin only)
router.patch('/:id/status', verifyToken, isAdmin, supportController.updateSupportStatus);

module.exports = router;
