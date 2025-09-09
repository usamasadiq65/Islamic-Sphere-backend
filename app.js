// app.js
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const CONFIG = require("./config");
const passportConfig = require('./config/passport');
const cors = require('cors');
const path = require('path');

const userRouter = require("./routes/user");
const duaRouter = require("./routes/dua");
const groupRouter = require("./routes/group");
const contactRouter = require("./routes/contact");
const sessionRouter = require("./routes/session");
const scholarRoutes = require("./routes/scholar");
const eventRoutes = require('./routes/event');
const chatRoutes = require('./routes/chat.routes');
const streamRoutes = require('./routes/stream.routes');
const supportRoutes = require('./routes/support.routes');
const prayerRoutes = require('./routes/prayer');
const prayerSectionRoutes = require('./routes/prayerSection');
const zakatRoutes = require('./routes/zakat');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = express(); // Create the Express app first

// MongoDB Connection Loop
let mongoConnected = false;

(async () => {
  while (true) {
    console.log("Connecting to MongoDB");
    mongoose.connect(CONFIG.MONGO_URI)
      .then(() => {
        console.log("Connected to MongoDB");
        mongoConnected = true;
      })
      .catch((err) => {
        console.log("MongoDB connection error:", err);
      });

    await sleep(3000);
    if (mongoConnected) {
      break;
    }
  }
})();

// Middleware Setup
app.use(morgan("dev"));
app.use(bodyParser.json({
  limit: '50mb'
}));
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
app.use(cookieParser());

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
  secret: "secret",
  resave: false,
  saveUninitialized: false,
  // store: new MongoStore({ mongooseConnection: mongoose.connection }),
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(
  cors({
    credentials: true,
  })
)

app.use("/auth", userRouter);
app.use("/duas", duaRouter);
app.use("/groups", groupRouter);
app.use("/contacts", contactRouter);
app.use("/sessions", sessionRouter);
app.use("/scholars", scholarRoutes);
app.use("/events", eventRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/support", supportRoutes);
app.use('/api/prayer', prayerRoutes);
app.use('/api/prayer-section', prayerSectionRoutes);
app.use('/api/zakat', zakatRoutes);


// Basic route
app.get("/", (req, res) => {
  res.send("Hello World");
});

// Export the app for bin/www to handle
module.exports = app;
