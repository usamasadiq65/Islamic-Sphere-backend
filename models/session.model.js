const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sessionSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  title: { type: String },
  date: { type: String },
  startTime: { type: String },
  image: { type: String },
  scholarImage: { type: String },
  zoomLink: { type: String },
  meetingPlatform: { type: String, enum: ['zoom', 'googlemeet'], default: 'zoom' },
  location: { type: String },
  endTime: { type: String },
  // Reference to ScholarSession (for admin-created sessions with existing scholars)
  scholarSession: {
    type: Schema.Types.ObjectId,
    ref: 'ScholarSession'
  },
  // Direct scholar info (for scholar-created sessions using their user account)
  scholarUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  scholarName: { type: String },
  
  // Recall.ai integration fields
  recallBotId: { type: String }, // Bot ID from Recall.ai
  recordingId: { type: String }, // Recording ID from Recall.ai
  transcriptId: { type: String }, // Transcript ID from Recall.ai
  
  // Transcript and AI analysis fields
  transcript: { type: String }, // Raw/refined transcript text
  transcriptData: { type: Schema.Types.Mixed }, // Structured transcript data (speaker info, timestamps, etc.)
  summary: { type: String }, // AI-generated summary of the session
  actionItems: [{ type: String }], // Array of action items from the session
  keyPoints: [{ type: String }], // Key discussion points
  
  // Processing status
  transcriptStatus: { 
    type: String, 
    enum: ['pending', 'recording', 'processing', 'completed', 'failed'], 
    default: 'pending' 
  },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
