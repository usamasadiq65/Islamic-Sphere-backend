const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  phone: { type: String, default: '' },
  image: { type: String, default: '' },
  bio: { type: String, default: '' },
  lastLogin: { type: Date },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
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
