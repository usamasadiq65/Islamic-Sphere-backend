'use strict'

const CONFIG = require('../config')
const User = require('../models/user.model')
const passportJWT = require('passport-jwt')

const ExtractJwt = passportJWT.ExtractJwt
const JwtStrategy = passportJWT.Strategy

const jwtOptions = {
  secretOrKey: CONFIG.JWT_SECRET,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
}

const jwtStrategy = new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
  console.log("jwtPayload")
  console.log(jwtPayload)
  try {
    const user = await User.findById(jwtPayload.id)
    console.log("user")
    console.log(user)
    if (user) {
      return done(null, user)
    } else {
      return done(null, false)
    }
  } catch (err) {
    return done(err, null)
  }
})

exports.jwtOptions = jwtOptions
exports.jwt = jwtStrategy