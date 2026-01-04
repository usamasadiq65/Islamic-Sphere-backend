const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Track individual task completion/miss records
const TaskProgressSchema = new Schema({
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  task: { 
    type: Schema.Types.ObjectId, 
    ref: 'Task', 
    required: true 
  },
  group: { 
    type: Schema.Types.ObjectId, 
    ref: 'Group', 
    required: true 
  },
  taskTitle: {
    type: String,
    required: true
  },
  taskDescription: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['completed', 'missed'],
    required: true
  },
  // The date when the task was completed or when it was marked as missed
  completedAt: {
    type: Date,
    default: null
  },
  // The deadline that was set for this task
  deadline: {
    type: Date,
    required: true
  },
  // Store the date for easier querying (YYYY-MM-DD format)
  dateKey: {
    type: String,
    required: true
  }
}, { timestamps: true });

// Indexes for efficient querying
TaskProgressSchema.index({ user: 1, dateKey: 1 });
TaskProgressSchema.index({ user: 1, status: 1 });
TaskProgressSchema.index({ user: 1, createdAt: -1 });
TaskProgressSchema.index({ task: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('TaskProgress', TaskProgressSchema);
