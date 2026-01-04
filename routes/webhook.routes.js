const express = require("express");
const webhookController = require("../controllers/webhook.controller");

const router = express.Router();

// Route for handling incoming webhooks from Recall.ai
router.post("/recall", webhookController.handleRecallWebhook);

module.exports = router;
