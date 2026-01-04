const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// User's personal task library - tasks they've saved for reuse
const UserTaskListSchema = new Schema({
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String,
    default: ''
  },
  category: { 
    type: String,
    default: 'Custom'
  },
  isBuiltIn: {
    type: Boolean,
    default: false
  },
  // Reference to original built-in task if copied from there
  builtInTaskId: {
    type: Number,
    default: null
  }
}, { timestamps: true });

// Compound index to prevent duplicate tasks for the same user
UserTaskListSchema.index({ user: 1, title: 1 }, { unique: true });

module.exports = mongoose.model('UserTaskList', UserTaskListSchema);
