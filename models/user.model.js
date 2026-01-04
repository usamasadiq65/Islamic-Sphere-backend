const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true }, // Primary email - cannot be removed
  password: { type: String, required: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  phone: { type: String, default: '' },
  phoneCountryCode: { type: String, default: '' },
  isPhoneVerified: { type: Boolean, default: false },
  phoneVerificationCode: { type: String },
  phoneVerificationExpiry: { type: Date },
  image: { type: String, default: '' },
  bio: { type: String, default: '' },
  lastLogin: { type: Date },
  role: { type: String, enum: ['admin', 'user', 'scholar'], default: 'user' },
  // Scholar-specific fields (only used when role is 'scholar')
  scholarInfo: {
    specialty: { type: String, default: '' },
    availability: { type: String, default: '' },
    languages: [{ type: String }],
    certifications: [{ type: String }],
    rating: { type: Number, default: 0, min: 0, max: 5 }
  },
  // Secondary emails array - can be added/removed
  secondaryEmails: [{
    email: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String },
    addedAt: { type: Date, default: Date.now }
  }],
  resetCode: {
    type: String
  },
  resetCodeExpiry: {
    type: Date
  },
  verificationCode: {
    type: String
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  requests: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  hiddenProgress: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group'
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
