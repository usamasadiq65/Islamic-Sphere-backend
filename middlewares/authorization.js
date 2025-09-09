"use strict";

// const User = require('../models/user.model');
const passport = require("passport");
const bluebird = require("bluebird");

// handleJWT with roles
const handleJWT = (req, res, next) => async (err, user, info) => {
  const error = err || info;
  const logIn = bluebird.promisify(req.logIn);

  try {
    // Check authorization header first
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Unauthorized - Invalid token format" });
    }

    // Extract token
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    if (error || !user) {
      return res.status(401).json({
        message: "Unauthorized - Invalid token",
        details: error?.message || 'Token validation failed'
      });
    }

    // Check if user is admin
    if (user.role === 'admin') {
      console.log('Admin access granted');
      // Allow admin to proceed regardless of other conditions
      await logIn(user, { session: false });
      req.user = user;
      req.token = token;
      req.isAdmin = true; // Add flag to identify admin users
      return next();
    }

    await logIn(user, { session: false });
    req.user = user;
    req.token = token;
    return next();
  } catch (e) {
    console.error('Authorization error:', e);
    return res.status(401).json({
      message: "Unauthorized - Authentication failed",
      details: e.message
    });
  }
};

const authorize = (req, res, next) =>
  passport.authenticate('jwt', { session: false }, handleJWT(req, res, next))(
    req,
    res,
    next
  );

module.exports = authorize;
