const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const ScholarSession = require('../models/scholarSession.model');
const Session = require('../models/session.model');

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/fyp-db';
console.log('Using MONGO_URI:', mongoURI);

async function seedScholars() {
  const jsonFilePath = path.join(__dirname, 'scholar.json');
  const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  const scholarsData = data.scholarsSessions;
  if (!Array.isArray(scholarsData)) {
    throw new Error('scholarsSessions data is not an array in scholar.json');
  }
  await ScholarSession.deleteMany({});
  const insertedScholars = await ScholarSession.insertMany(scholarsData);
  console.log('Scholars seeded successfully');
  return insertedScholars;
}

async function seedSessions(insertedScholars) {
  const jsonFilePath = path.join(__dirname, 'session.json');
  const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  const sessionsData = data.featuredSessions;
  if (!Array.isArray(sessionsData)) {
    throw new Error('featuredSessions data is not an array in session.json');
  }

  // Create a map of scholar name to _id for quick lookup
  const scholarNameToId = {};
  insertedScholars.forEach(scholar => {
    scholarNameToId[scholar.name] = scholar._id;
  });

  // Transform data to match session model schema
  const sessionsToInsert = sessionsData.map(item => {
    let scholarId = item.scholar;
    // If the scholar field is a name, map it to the ObjectId
    if (typeof item.scholar === 'string' && scholarNameToId[item.scholar]) {
      scholarId = scholarNameToId[item.scholar];
    }
    return {
      name: item.title,
      description: item.description,
      title: item.title,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      image: item.image,
      scholarImage: item.scholarImage,
      zoomLink: item.zoomLink,
      location: item.location,
      scholar: scholarId
    };
  });

  await Session.deleteMany({});
  await Session.insertMany(sessionsToInsert);
  console.log('Sessions seeded successfully');
}

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('Connected to MongoDB for seeding scholars and sessions');
    const insertedScholars = await seedScholars();
    await seedSessions(insertedScholars);
    await mongoose.connection.close();
    console.log('Seeding completed successfully');
  })
  .catch(err => {
    console.error('Error seeding data:', err);
    process.exit(1);
  }); 