const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const STREAM_API_KEY = process.env.STREAM_API_KEY;
const STREAM_API_SECRET = process.env.STREAM_API_SECRET;

module.exports = {
  MONGO_URI,
  JWT_SECRET,
  JWT_EXPIRATION,
  ANTHROPIC_API_KEY,
  STREAM_API_KEY,
  STREAM_API_SECRET
};

