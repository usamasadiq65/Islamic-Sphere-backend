const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const authorize = require('../middlewares/authorization');
const axios = require('axios');

// Route to search cities worldwide using OpenCage API
router.get('/cities/search', async (req, res) => {
  const { query } = req.query;

  if (!query || query.length < 2) {
    return res.status(400).json({ 
      success: false, 
      error: 'Query must be at least 2 characters' 
    });
  }

  try {
    const response = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
      params: {
        q: query,
        key: process.env.OPENCAGE_API_KEY,
        limit: 15,
        no_annotations: 1,
        language: 'en'
      }
    });

    if (!response.data.results || response.data.results.length === 0) {
      return res.json({ 
        success: true, 
        data: [],
        message: 'No cities found' 
      });
    }

    // Filter and format the results to get meaningful city data
    const cities = response.data.results
      .filter(result => {
        // Filter out results that don't have meaningful location data
        const components = result.components;
        return components && (
          components.city || 
          components.town || 
          components.village || 
          components.county ||
          components.state ||
          components.country
        );
      })
      .map(result => {
        const components = result.components;
        
        // Create a meaningful city name
        let cityName = '';
        if (components.city) {
          cityName = components.city;
        } else if (components.town) {
          cityName = components.town;
        } else if (components.village) {
          cityName = components.village;
        } else if (components.county) {
          cityName = components.county;
        } else if (components.state) {
          cityName = components.state;
        }

        // Add country for context
        if (components.country && cityName !== components.country) {
          cityName += `, ${components.country}`;
        }

        return {
          value: cityName,
          label: cityName,
          formatted: result.formatted,
          country: components.country,
          coordinates: {
            lat: result.geometry.lat,
            lng: result.geometry.lng
          }
        };
      })
      // Remove duplicates based on value
      .filter((city, index, self) => 
        index === self.findIndex(c => c.value.toLowerCase() === city.value.toLowerCase())
      )
      // Sort alphabetically
      .sort((a, b) => a.value.localeCompare(b.value));

    res.json({ 
      success: true, 
      data: cities 
    });

  } catch (error) {
    console.error("Error fetching cities:", error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch cities' 
    });
  }
});

// Public routes
router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getEventById);

// Protected routes (admin only)
router.post('/', authorize, eventController.createEvent);
router.put('/:id', authorize, eventController.updateEvent);
router.delete('/:id', authorize, eventController.deleteEvent);

module.exports = router;