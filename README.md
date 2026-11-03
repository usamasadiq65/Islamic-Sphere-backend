# Islamic Sphere - Backend API

The API and background services for Islamic Sphere. It handles accounts, learning and community data, scholar sessions, events, prayer tools, Zakat, and integrations used by the user frontend and admin panel.

## Features

- Express REST API with MongoDB persistence through Mongoose
- Passport JWT authentication and protected routes
- User, group, chat, dua, event, scholar session, and support APIs
- File upload and static serving for uploaded resources
- Stream Chat integration for community chat
- Scholar-session bot and recording workflows using Recall.ai webhooks
- Transcript analysis through the configured Anthropic service
- SMS, email, and scheduled background tasks through configured providers
- Prayer/location and Zakat endpoints

## Tech stack

- Node.js and Express 4
- MongoDB and Mongoose
- Passport, JWT, and bcryptjs
- Stream Chat, Recall.ai, Anthropic, Twilio, and Nodemailer integrations
- Multer for uploads and node-cron for scheduled jobs

## Requirements and setup

- Node.js and npm
- A MongoDB database

Install dependencies from this directory:

```bash
npm install
```

Create a `.env` file and supply the values for the services you enable:

```env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/islamic-sphere
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRATION=7d
ANTHROPIC_API_KEY=your_anthropic_api_key
STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret
```

Optional integrations use `RECALL_AI_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, and `OPENCAGE_API_KEY`. Set email sender credentials as required by the Nodemailer configuration. Never commit `.env` or expose private keys in frontend variables.

Start the development server:

```bash
npm run dev
```

The API listens on port 3000 by default. The frontend's `REACT_APP_API_BASE_URL` should point to the API origin expected by its API client.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start with nodemon on port 3000 |
| `npm start` | Start the server on port 3000 |
| `npm test` | No test suite is configured in this package yet |

## API groups

Routes are mounted under `/auth`, `/duas`, `/groups`, `/contacts`, `/sessions`, `/scholars`, `/events`, `/api/chat`, `/api/stream`, `/api/support`, `/api/prayer`, `/api/prayer-section`, `/api/zakat`, and `/api/webhooks`.

## Source layout

- `controllers/` - API request handlers
- `routes/` - Express route modules
- `models/` - Mongoose models
- `services/` - authentication, background jobs, bot dispatch, and transcript processing
- `middlewares/` - authorization and role checks
- `uploads/` - uploaded files served by the API
