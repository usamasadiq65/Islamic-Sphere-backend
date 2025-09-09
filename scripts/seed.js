// scripts/seed.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Dua = require('../models/dua.model');
const CONFIG = require('../config');

// Connect to MongoDB
mongoose.connect(CONFIG.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(async () => {
    console.log('Connected to MongoDB for seeding');

    // Since the JSON file is in the root directory and this script is in "scripts",
    // we use ".." to move up one level.
    const jsonFilePath = path.join(__dirname, '..', 'duas.json');
    const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

    // remove prev all entries
    await Dua.deleteMany({});

    // Transform the nested JSON data into an array of Dua objects
    const duasToInsert = [];

    // Iterate over each emotion in the JSON file
    for (const emotion in data.emotions) {
      if (data.emotions.hasOwnProperty(emotion)) {
        const emotionData = data.emotions[emotion];

        // Process Quranic Duas
        if (Array.isArray(emotionData.quranicDuas)) {
          emotionData.quranicDuas.forEach(dua => {
            duasToInsert.push({
              emotion: emotion,       // e.g., "happy"
              type: 'quranic',
              reference: dua.reference,
              arabic: dua.arabic,
              urduTranslation: dua.urduTranslation
            });
          });
        }

        // Process Ahadees Duas
        if (Array.isArray(emotionData.ahadeesDuas)) {
          emotionData.ahadeesDuas.forEach(dua => {
            duasToInsert.push({
              emotion: emotion,
              type: 'hadees',
              reference: dua.reference,
              arabic: dua.arabic,
              urduTranslation: dua.urduTranslation
            });
          });
        }
      }
    }

    // Insert the transformed data into the database
    await Dua.insertMany(duasToInsert);
    console.log('Data inserted successfully');
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error:', err);
    mongoose.disconnect();
  });  