const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PollSchema = new Schema({
  title: { type: String, required: true },
  options: [{
    text: String,
    votes: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  isCustom: { type: Boolean, default: true },
  deadline: { type: Date, required: true },
  group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
}, {
  timestamps: true
});

module.exports = mongoose.model('Poll', PollSchema);






