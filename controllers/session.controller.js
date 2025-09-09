const Session = require('../models/session.model');
const User = require('../models/user.model');
const nodemailer = require('nodemailer');

// Get all sessions
const getAllSessions = async (req, res) => {
  try {
    const sessions = await Session.find()
      .populate('scholarSession', 'name image specialty'); // Populate scholar details
    res.json({ 
      success: true, 
      data: sessions, 
      message: 'Sessions fetched successfully' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get a session by ID
const getSessionById = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('scholarSession', 'name image specialty bio availability');
    if (!session) return res.status(404).json({ 
      success: false, 
      message: 'Session not found' 
    });
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new session
const createSession = async (req, res) => {
  try {
    // Validate scholar existence
    if (!req.body.scholarSession) {
      return res.status(400).json({
        success: false,
        message: 'Scholar ID is required'
      });
    }

    const session = new Session(req.body);
    await session.save();

    // Fetch the saved session with populated scholar details
    const populatedSession = await Session.findById(session._id)
      .populate('scholarSession', 'name image specialty');

    // Send email notifications to all registered users
    try {
      // Get all verified users
      const users = await User.find({ isVerified: true }, 'email username');
      
      if (users.length > 0) {
        // Create nodemailer transporter
        const transporter = nodemailer.createTransport({
          port: 465,
          host: "smtp.gmail.com",
          auth: {
            user: process.env.SENDER,
            pass: process.env.PASSWORD,
          },
          secure: true,
        });

        // Format the session date
        const sessionDate = new Date(req.body.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        // Get scholar name for email
        const scholarName = populatedSession.scholarSession?.name || 'Scholar';

        // Create email template
        const emailPromises = users.map(user => {
          const mailData = {
            from: process.env.SENDER,
            to: user.email,
            subject: `New Q&A Session Scheduled: ${req.body.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #2c5530; text-align: center;">📚 New Q&A Session Scheduled!</h2>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #2c5530; margin-top: 0;">${req.body.title}</h3>
                  <p style="color: #666; margin: 10px 0;"><strong>👨‍🏫 Scholar:</strong> ${scholarName}</p>
                  <p style="color: #666; margin: 10px 0;"><strong>📅 Date:</strong> ${sessionDate}</p>
                  <p style="color: #666; margin: 10px 0;"><strong>🕐 Time:</strong> ${req.body.startTime} - ${req.body.endTime}</p>
                  <p style="color: #666; margin: 10px 0;"><strong>💻 Platform:</strong> ${req.body.meetingPlatform || 'Zoom'}</p>
                </div>
                
                <p style="color: #666;">Dear ${user.username},</p>
                <p style="color: #666;">A new Q&A session has been scheduled on Islamic Sphere platform! Join us for an enlightening discussion with our scholar.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="http://localhost:3001/qna" style="background-color: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Session Details</a>
                </div>
                
                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
                  This email was sent from Islamic Sphere. If you no longer wish to receive these notifications, please contact support.
                </p>
              </div>
            `,
          };
          
          return transporter.sendMail(mailData);
        });

        // Send all emails
        await Promise.all(emailPromises);
        console.log(`Email notifications sent to ${users.length} users for new session: ${req.body.title}`);
      }
    } catch (emailError) {
      // Log email error but don't fail the session creation
      console.error('Error sending email notifications:', emailError);
    }

    res.status(201).json({ 
      success: true, 
      data: populatedSession, 
      message: 'Session created successfully and notifications sent' 
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Update a session
const updateSession = async (req, res) => {
  try {
    const session = await Session.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    ).populate('scholarSession', 'name image specialty');

    if (!session) return res.status(404).json({ 
      success: false, 
      message: 'Session not found' 
    });

    res.json({ 
      success: true, 
      data: session, 
      message: 'Session updated successfully' 
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete a session
const deleteSession = async (req, res) => {
  try {
    const session = await Session.findByIdAndDelete(req.params.id);
    if (!session) return res.status(404).json({ 
      success: false, 
      message: 'Session not found' 
    });
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get sessions by scholar
const getSessionsByScholar = async (req, res) => {
  try {
    const sessions = await Session.find({ 
      scholarSession: req.params.scholarId 
    }).populate('scholarSession', 'name image specialty');

    res.json({ 
      success: true, 
      data: sessions, 
      message: 'Scholar sessions fetched successfully' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Count sessions endpoint
const getSessionCount = async (req, res) => {
  try {
    const Session = require('../models/session.model');
    console.log('About to count Session documents');
    const count = await Session.countDocuments().catch(err => {
      console.error('Error in countDocuments:', err);
      throw err;
    });
    console.log('Session count:', count);
    res.json({ count });
  } catch (err) {
    console.error('Error in getSessionCount:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

module.exports = {
  getAllSessions,
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
  getSessionsByScholar,
  getSessionCount
};
