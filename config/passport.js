const passport = require("passport");
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/user.model');

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your-secret-key' // Fallback for testing
};

// Initialize JWT Strategy
passport.use(
  new JwtStrategy(opts, async (jwt_payload, done) => {
    try {
      // console.log('JWT Payload received:', jwt_payload); // Debug log
      const user = await User.findById(jwt_payload.id);
      // console.log('Found user:', user); // Debug log
      if (user) {
        return done(null, user);
      }
      return done(null, false);
    } catch (err) {
      console.error('Passport JWT Error:', err);
      return done(err, false);
    }
  })
);

module.exports = passport;
