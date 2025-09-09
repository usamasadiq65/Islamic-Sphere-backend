const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const authMiddleware = require('../middlewares/authorization');

// All chat routes require authentication
router.use(authMiddleware);

// Send message and get AI response
router.post('/message', chatController.sendMessage);

// Get chat history for the user
router.get('/history', chatController.getChatHistory);

module.exports = router;
