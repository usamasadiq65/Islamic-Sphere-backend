const mongoose = require('mongoose');
const Dua = require('../models/dua');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/fyp-db', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('Connected to MongoDB');
    // Add your script functionality here
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  })
  .finally(() => {
    // Optionally disconnect when done
    // mongoose.disconnect();
  });

// const testDua = async () => {
//   try {
//     const dua = await Dua.findOne({ name: 'Dua for Peace' });
//     console.log(dua);
//   } catch (error) {
//     console.error('Error fetching Dua:', error);
//   }
// };

// testDua();
