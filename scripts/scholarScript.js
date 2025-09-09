const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const ScholarSession = require('../models/scholarSession.model');
const dotenv = require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/fyp-db';
console.log('Using MONGO_URI:', mongoURI);

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('Connected to MongoDB for seeding scholars');

    // Read and parse the JSON file
    const jsonFilePath = path.join(__dirname, 'scholar.json');
    const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

    // Transform data to match the model schema
    const scholarsData = data.scholarsSessions;
    if (!Array.isArray(scholarsData)) {
      throw new Error('scholarsSessions data is not an array in JSON file');
    }

    // Remove all existing scholar sessions
    await ScholarSession.deleteMany({});

    // Remove/ignore the sessions field before inserting
    const cleanedScholars = scholarsData.map(sch => {
      const { sessions, ...rest } = sch;
      return rest;
    });

    // Insert the new scholar sessions
    await ScholarSession.insertMany(cleanedScholars);

    console.log('Scholar seeding completed successfully');
    await mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error seeding scholars:', err);
    process.exit(1);
  });
