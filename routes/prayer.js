const express = require('express');
const router = express.Router();
const axios = require('axios');
const authorize = require('../middlewares/authorization');

// Route: /api/prayer/times?lat=xx&lng=yy
router.get('/times', async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Missing lat/lng' });
  }

  try {
    const response = await axios.get('https://api.aladhan.com/v1/timings', {
      params: {
        latitude: lat,
        longitude: lng,
        method: 2, // You can customize the method
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prayer times' });
  }
});






// Route: /api/prayer/timesByCity?city=xxx&country=yyy
// router.get('/timesByCity', async (req, res) => {
//   const { city, country } = req.query;

//   if (!city || !country) {
//     return res.status(400).json({ error: 'Missing city or country' });
//   }

//   try {
//     // 1. Convert city + country to coordinates (OpenCage API)
//     const geoRes = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
//       params: {
//         q: `${encodeURIComponent(city)}, ${encodeURIComponent(country)}`,
//         key: process.env.OPENCAGE_API_KEY
//       }
//     });
//     console.log("OpenCage key:", process.env.OPENCAGE_API_KEY);
//     console.log("geoRes:", geoRes.data);
//     if (!geoRes.data.results.length) {
//       return res.status(404).json({ error: 'Location not found' });
//     }

//     const { lat, lng } = geoRes.data.results[0].geometry;

//     // 2. Get prayer times from Aladhan API using coordinates
//     const prayerRes = await axios.get('https://api.aladhan.com/v1/timings', {
//       params: {
//         latitude: lat,
//         longitude: lng,
//         method: 2
//       }
//     });

//     res.json(prayerRes.data);

//   } catch (error) {
//     console.error("Error fetching prayer times:", error.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to fetch prayer times' });
//   }
// });



router.get('/timesByCity', async (req, res) => {
  const { city, country } = req.query;

  if (!city || !country) {
    return res.status(400).json({ error: 'Missing city or country' });
  }

  try {
    // Get coordinates from OpenCage
    const geoRes = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
      params: {
        q: `${city}, ${country}`,
        key: process.env.OPENCAGE_API_KEY
      }
    });

    if (!geoRes.data.results.length) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const { lat, lng } = geoRes.data.results[0].geometry;

    // Get prayer times from Aladhan (with timestamp)
    const timestamp = Math.floor(Date.now() / 1000);
    const prayerRes = await axios.get(`https://api.aladhan.com/v1/timings/${timestamp}`, {
      params: {
        latitude: lat,
        longitude: lng,
        method: 2
      }
    });

    res.json(prayerRes.data);

  } catch (error) {
    console.error("Error fetching prayer times:", error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch prayer times' });
  }
});

// Route: /api/prayer/reverse-geocode?lat=xx&lng=yy
router.get('/reverse-geocode', async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Missing lat/lng' });
  }

  try {
    // Use OpenCage for reverse geocoding
    const geoRes = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
      params: {
        q: `${lat}+${lng}`,
        key: process.env.OPENCAGE_API_KEY
      }
    });

    if (!geoRes.data.results.length) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const result = geoRes.data.results[0];
    const components = result.components;
    
    // Extract meaningful location information
    const locationInfo = {
      city: components.city || components.town || components.village || components.county,
      state: components.state || components.province || components.region,
      country: components.country,
      formatted: result.formatted
    };

    res.json(locationInfo);

  } catch (error) {
    console.error("Error reverse geocoding:", error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to reverse geocode location' });
  }
});

module.exports = router;
