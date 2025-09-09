const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ContactSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contacts: [
    {
      contactUser: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      approved: {
        type: Boolean,
        default: false
      },
      dateAdded: {
        type: Date,
        default: Date.now
      }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Contact', ContactSchema); 