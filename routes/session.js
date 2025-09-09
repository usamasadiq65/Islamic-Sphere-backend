const express = require('express');
const router = require("express").Router();
const sessionController = require("../controllers/session.controller");

// Route to get session count
router.get('/count', sessionController.getSessionCount);

// Get all sessions
router.get('/', sessionController.getAllSessions);
// Get a session by ID
router.get('/:id', sessionController.getSessionById);
// Create a new session
router.post('/', sessionController.createSession);
// Update a session
router.put('/:id', sessionController.updateSession);
// Delete a session
router.delete('/:id', sessionController.deleteSession);
// Get sessions by scholar
router.get('/scholar/:scholarId', sessionController.getSessionsByScholar);

module.exports = router;
