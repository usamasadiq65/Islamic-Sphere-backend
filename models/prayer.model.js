const mongoose = require('mongoose');

const PrayerRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  prayers: {
    Fajr: {
      completed: { type: Boolean, default: false },
      completedAt: { type: Date }
    },
    Dhuhr: {
      completed: { type: Boolean, default: false },
      completedAt: { type: Date }
    },
    Asr: {
      completed: { type: Boolean, default: false },
      completedAt: { type: Date }
    },
    Maghrib: {
      completed: { type: Boolean, default: false },
      completedAt: { type: Date }
    },
    Isha: {
      completed: { type: Boolean, default: false },
      completedAt: { type: Date }
    }
  },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    city: { type: String },
    country: { type: String }
  }
}, { timestamps: true });

// Compound index to ensure one record per user per date
PrayerRecordSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('PrayerRecord', PrayerRecordSchema);