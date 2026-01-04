const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GroupSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Original creator - cannot be removed
  owners: [{ type: Schema.Types.ObjectId, ref: 'User' }], // Additional owners who can manage the group
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  hiddenMembers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  polls: [{ type: Schema.Types.ObjectId, ref: 'Poll' }],
  // Stream Chat integration fields
  streamChannelId: { type: String },
  streamChannelType: { type: String, default: 'messaging' },
}, { timestamps: true });

module.exports = mongoose.model('Group', GroupSchema);
