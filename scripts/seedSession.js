const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Session = require('../models/session.model');
const dotenv = require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/fyp-db';
console.log('Using MONGO_URI:', mongoURI);

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('Connected to MongoDB for seeding sessions');

    // Read and parse the JSON file
    const jsonFilePath = path.join(__dirname, 'session.json');
    const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

    // Transform sessions to match the schema (map title -> name)
    const sessionsData = data.featuredSessions;
    if (!Array.isArray(sessionsData)) {
      throw new Error('featuredSessions data is not an array in session.json');
    }

    const sessionsToInsert = sessionsData.map(item => ({
      ...item,
      name: item.title || item.name // use title as name if present
    }));

    // Remove all existing sessions
    await Session.deleteMany({});

    // Insert the transformed sessions
    await Session.insertMany(sessionsToInsert);

    console.log('Sessions seeding completed successfully');
    await mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error seeding sessions:', err);
    process.exit(1);
  });
