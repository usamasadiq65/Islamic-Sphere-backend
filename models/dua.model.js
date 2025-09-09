const mongoose = require('mongoose');
const DuaSchema = new mongoose.Schema({
  emotion: { type: String, required: true },
  type: { type: String, required: true, enum: ['quranic', 'hadees'] },
  reference: { type: String, required: true },
  arabic: { type: String, required: true },
  urduTranslation: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Dua', DuaSchema);
