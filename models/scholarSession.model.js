const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const scholarSessionSchema = new Schema({
  name: { type: String, required: true },
  specialty: { type: String },
  rating: { type: Number },
  image: { type: String },
  bio: { type: String },
  availability: { type: String },

  students: { type: Number },
  languages: { type: [String] },
  certifications: { type: [String] },
  sessions: [{ type: Schema.Types.ObjectId, ref: 'Session' }]

}, { timestamps: true });

module.exports = mongoose.model('ScholarSession', scholarSessionSchema);




