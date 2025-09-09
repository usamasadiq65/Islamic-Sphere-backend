const express = require('express');
const router = express.Router();
const authorize = require('../middlewares/authorization');
const {
    createSupport,
    getAllSupports,
    getUserSupports,
    updateSupportStatus,
    deleteSupport
} = require('../controllers/support.controller');

// Make sure all support routes are protected
// router.use(authorize);

// Create a new support ticket
router.post('/', createSupport);

// Get all support tickets (admin only)
router.get('/admin/all', getAllSupports);

// Get support tickets by user email
router.get('/user/:email', getUserSupports);

// Update support ticket status (admin only)
router.patch('/admin/:id/status', updateSupportStatus);

// Delete a support ticket (admin only)
router.delete('/admin/:id', deleteSupport);

module.exports = router;
