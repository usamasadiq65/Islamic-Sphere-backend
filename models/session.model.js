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
  scholarSession: {
    type: Schema.Types.ObjectId,
    ref: 'ScholarSession'
  },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
