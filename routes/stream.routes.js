const express = require('express');
const router  = express.Router();
const { StreamChat } = require('stream-chat');
const CONFIG = require('../config');

// Initialise server client once
const serverClient = StreamChat.getInstance(
  CONFIG.STREAM_API_KEY,
  CONFIG.STREAM_API_SECRET
);

/**
 * POST /api/stream/gen-user-token
 * Body: { userId }
 * Returns: { token }
 */
router.post('/gen-user-token', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    // Generate token and ensure the user exists in Stream
    const token = serverClient.createToken(userId);
    await serverClient.upsertUser({ id: userId, name: userId });

    res.json({ token });
  } catch (err) {
    console.error('Stream token error:', err);
    res.status(500).json({ error: err.message || 'Stream error' });
  }
});

module.exports = router;
