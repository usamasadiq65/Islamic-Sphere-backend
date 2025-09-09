const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TaskSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  usersCompleted: {
    type: Array,
    default: []         //user id
  },
  deadline: {
    type: Date
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  isBuiltIn: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    enum: ['Quran', 'Dhikr', 'Hadith', 'Other'],
    default: 'Other'
  },
  group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Task', TaskSchema);
