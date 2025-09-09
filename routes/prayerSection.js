const express = require('express');
const router = express.Router();
const authorize = require('../middlewares/authorization');
const {
  markPrayerCompleted,
  unmarkPrayer,
  getPrayerRecordsByDate,
  getPrayerRecordsByDateRange,
  getPrayerStats,
  deletePrayerRecord
} = require('../controllers/prayer.controller');

// Mark prayer as completed
router.post('/mark-completed', authorize, markPrayerCompleted);

// Unmark prayer (set as incomplete)
router.post('/unmark', authorize, unmarkPrayer);

// Get prayer records for a specific date
router.get('/records/:date', authorize, getPrayerRecordsByDate);

// Get prayer records for a date range
router.get('/records', authorize, getPrayerRecordsByDateRange);

// Get prayer statistics
router.get('/stats', authorize, getPrayerStats);

// Delete prayer record for a specific date
router.delete('/records/:date', authorize, deletePrayerRecord);

module.exports = router;

// API Endpoints:
// POST   /api/prayer/mark-completed     - Mark prayer as completed
// POST   /api/prayer/unmark            - Unmark prayer
// GET    /api/prayer/records/:date     - Get records for specific date
// GET    /api/prayer/records           - Get records for date range
// GET    /api/prayer/stats             - Get prayer statistics
// DELETE /api/prayer/records/:date     - Delete prayer record