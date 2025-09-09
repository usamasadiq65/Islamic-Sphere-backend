const PrayerRecord = require('../models/prayer.model');

// Helper function to get prayer record response
const getPrayerRecordResponse = (prayerRecord) => {
  return {
    id: prayerRecord._id,
    userId: prayerRecord.userId,
    date: prayerRecord.date,
    prayers: prayerRecord.prayers,
    location: prayerRecord.location,
    createdAt: prayerRecord.createdAt,
    updatedAt: prayerRecord.updatedAt
  };
};

// Mark prayer as completed
const markPrayerCompleted = async (req, res) => {
  try {
    const { date, prayerName, location } = req.body;
    const userId = req.user.id;

    // Validate prayer name
    const validPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    if (!validPrayers.includes(prayerName)) {
      return res.status(400).json({
        message: 'Invalid prayer name',
        data: null,
        error: 'Prayer name must be one of: Fajr, Dhuhr, Asr, Maghrib, Isha'
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        message: 'Invalid date format',
        data: null,
        error: 'Date must be in YYYY-MM-DD format'
      });
    }

    // Find or create prayer record for the user and date
    let prayerRecord = await PrayerRecord.findOne({ userId, date });

    if (!prayerRecord) {
      // Create new prayer record
      prayerRecord = new PrayerRecord({
        userId,
        date,
        prayers: {
          Fajr: { completed: false },
          Dhuhr: { completed: false },
          Asr: { completed: false },
          Maghrib: { completed: false },
          Isha: { completed: false }
        },
        location
      });
    }

    // Mark the specific prayer as completed
    prayerRecord.prayers[prayerName].completed = true;
    prayerRecord.prayers[prayerName].completedAt = new Date();

    // Update location if provided
    if (location) {
      prayerRecord.location = location;
    }

    await prayerRecord.save();

    return res.status(200).json({
      message: `${prayerName} prayer marked as completed`,
      data: { prayerRecord: getPrayerRecordResponse(prayerRecord) },
      error: null
    });

  } catch (error) {
    console.error('Error marking prayer as completed:', error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Unmark prayer (set as incomplete)
const unmarkPrayer = async (req, res) => {
  try {
    const { date, prayerName } = req.body;
    const userId = req.user.id;

    // Validate prayer name
    const validPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    if (!validPrayers.includes(prayerName)) {
      return res.status(400).json({
        message: 'Invalid prayer name',
        data: null,
        error: 'Prayer name must be one of: Fajr, Dhuhr, Asr, Maghrib, Isha'
      });
    }

    // Find prayer record
    const prayerRecord = await PrayerRecord.findOne({ userId, date });

    if (!prayerRecord) {
      return res.status(404).json({
        message: 'Prayer record not found',
        data: null,
        error: 'No prayer record found for this date'
      });
    }

    // Unmark the specific prayer
    prayerRecord.prayers[prayerName].completed = false;
    prayerRecord.prayers[prayerName].completedAt = undefined;

    await prayerRecord.save();

    return res.status(200).json({
      message: `${prayerName} prayer unmarked`,
      data: { prayerRecord: getPrayerRecordResponse(prayerRecord) },
      error: null
    });

  } catch (error) {
    console.error('Error unmarking prayer:', error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Get prayer records for a specific date
const getPrayerRecordsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user.id;

    const prayerRecord = await PrayerRecord.findOne({ userId, date });

    if (!prayerRecord) {
      return res.status(200).json({
        message: 'No prayer records found for this date',
        data: {
          prayerRecord: {
            date,
            prayers: {
              Fajr: { completed: false },
              Dhuhr: { completed: false },
              Asr: { completed: false },
              Maghrib: { completed: false },
              Isha: { completed: false }
            }
          }
        },
        error: null
      });
    }

    return res.status(200).json({
      message: 'Prayer records retrieved successfully',
      data: { prayerRecord: getPrayerRecordResponse(prayerRecord) },
      error: null
    });

  } catch (error) {
    console.error('Error getting prayer records:', error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Get prayer records for a date range
const getPrayerRecordsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user.id;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({
        message: 'Invalid date format',
        data: null,
        error: 'Dates must be in YYYY-MM-DD format'
      });
    }

    const prayerRecords = await PrayerRecord.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    const formattedRecords = prayerRecords.map(record => getPrayerRecordResponse(record));

    return res.status(200).json({
      message: 'Prayer records retrieved successfully',
      data: { prayerRecords: formattedRecords, count: formattedRecords.length },
      error: null
    });

  } catch (error) {
    console.error('Error getting prayer records by date range:', error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Get user's prayer statistics
const getPrayerStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;

    let matchCondition = { userId };

    // If month and year provided, filter by them
    if (month && year) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = `${year}-${month.padStart(2, '0')}-31`;
      matchCondition.date = { $gte: startDate, $lte: endDate };
    }

    const prayerRecords = await PrayerRecord.find(matchCondition);

    // Calculate statistics
    const stats = {
      totalDays: prayerRecords.length,
      prayerStats: {
        Fajr: { completed: 0, total: prayerRecords.length },
        Dhuhr: { completed: 0, total: prayerRecords.length },
        Asr: { completed: 0, total: prayerRecords.length },
        Maghrib: { completed: 0, total: prayerRecords.length },
        Isha: { completed: 0, total: prayerRecords.length }
      },
      totalPrayersCompleted: 0,
      totalPossiblePrayers: prayerRecords.length * 5
    };

    // Count completed prayers
    prayerRecords.forEach(record => {
      Object.keys(record.prayers).forEach(prayerName => {
        if (record.prayers[prayerName].completed) {
          stats.prayerStats[prayerName].completed++;
          stats.totalPrayersCompleted++;
        }
      });
    });

    // Calculate completion percentage
    stats.completionPercentage = stats.totalPossiblePrayers > 0 
      ? Math.round((stats.totalPrayersCompleted / stats.totalPossiblePrayers) * 100)
      : 0;

    return res.status(200).json({
      message: 'Prayer statistics retrieved successfully',
      data: { stats },
      error: null
    });

  } catch (error) {
    console.error('Error getting prayer statistics:', error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Delete prayer record (admin only or user's own records)
const deletePrayerRecord = async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user.id;

    const prayerRecord = await PrayerRecord.findOneAndDelete({ userId, date });

    if (!prayerRecord) {
      return res.status(404).json({
        message: 'Prayer record not found',
        data: null,
        error: 'No prayer record found for this date'
      });
    }

    return res.status(200).json({
      message: 'Prayer record deleted successfully',
      data: { deletedRecord: getPrayerRecordResponse(prayerRecord) },
      error: null
    });

  } catch (error) {
    console.error('Error deleting prayer record:', error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

module.exports = {
  markPrayerCompleted,
  unmarkPrayer,
  getPrayerRecordsByDate,
  getPrayerRecordsByDateRange,
  getPrayerStats,
  deletePrayerRecord
};