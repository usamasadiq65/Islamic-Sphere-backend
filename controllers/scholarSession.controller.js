const ScholarSession = require('../models/scholarSession.model');
const User = require('../models/user.model');
const nodemailer = require('nodemailer');

// Get all scholars
exports.getAllScholars = async (req, res) => {
  try {
    const scholars = await ScholarSession.find();
    res.json({ success: true, data: scholars });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch scholars', error: err.message });
  }
};

// Get a scholar by ID
exports.getScholarById = async (req, res) => {
  try {
    const scholar = await ScholarSession.findById(req.params.id);
    if (!scholar) {
      return res.status(404).json({ success: false, message: 'Scholar not found' });
    }
    res.json({ success: true, data: scholar });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch scholar', error: err.message });
  }
};

// Create a new scholar
exports.createScholar = async (req, res) => {
  try {
    const { name, specialty, rating, bio, availability, languages, certifications } = req.body;
    const scholarData = {
      name,
      specialty,
      rating,
      bio,
      availability,
      languages: JSON.parse(languages || '[]'),
      certifications: JSON.parse(certifications || '[]'),
    };

    if (req.file) {
      scholarData.image = req.file.filename;
    }

    const scholar = new ScholarSession(scholarData);
    await scholar.save();

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

        // Create email template
        const emailPromises = users.map(user => {
          const mailData = {
            from: process.env.SENDER,
            to: user.email,
            subject: `New Scholar Joined: ${name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #2c5530; text-align: center;">🎓 New Scholar Joined!</h2>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #2c5530; margin-top: 0;">${name}</h3>
                  <p style="color: #666; margin: 10px 0;"><strong>Specialty:</strong> ${specialty}</p>
                  <p style="color: #666; margin: 10px 0;"><strong>⭐ Rating:</strong> ${rating}/5</p>
                  <p style="color: #666; margin: 10px 0;"><strong>📚 Languages:</strong> ${scholarData.languages.join(', ')}</p>
                  <p style="color: #666; margin: 10px 0;"><strong>🕐 Availability:</strong> ${availability}</p>
                  ${scholarData.certifications.length > 0 ? `<p style="color: #666; margin: 10px 0;"><strong>🏆 Certifications:</strong> ${scholarData.certifications.join(', ')}</p>` : ''}
                </div>
                
                <p style="color: #666;">Dear ${user.username},</p>
                <p style="color: #666;">We're pleased to announce that a new scholar has joined Islamic Sphere platform! You can now connect with them for religious guidance and knowledge.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="http://localhost:3001/qna" style="background-color: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Scholar Profile</a>
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
        console.log(`Email notifications sent to ${users.length} users for new scholar: ${name}`);
      }
    } catch (emailError) {
      // Log email error but don't fail the scholar creation
      console.error('Error sending email notifications:', emailError);
    }

    res.status(201).json({ success: true, data: scholar, message: 'Scholar created successfully and notifications sent' });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Failed to create scholar', error: err.message });
  }
};

// Update a scholar
exports.updateScholar = async (req, res) => {
  try {
    const { name, specialty, rating, bio, availability, languages, certifications } = req.body;
    const updateData = {
      name,
      specialty,
      rating,
      bio,
      availability,
      languages: JSON.parse(languages || '[]'),
      certifications: JSON.parse(certifications || '[]'),
    };

    if (req.file) {
      updateData.image = req.file.filename;
    }

    const scholar = await ScholarSession.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!scholar) {
      return res.status(404).json({ success: false, message: 'Scholar not found' });
    }
    res.json({ success: true, data: scholar });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Failed to update scholar', error: err.message });
  }
};

// Count scholars endpoint
exports.getScholarCount = async (req, res) => {
  try {
    console.log('About to count ScholarSession documents');
    const count = await ScholarSession.countDocuments().catch(err => {
      console.error('Error in countDocuments:', err);
      throw err;
    });
    console.log('Scholar count:', count);
    res.json({ count });
  } catch (err) {
    console.error('Error in getScholarCount:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// Delete a scholar
exports.deleteScholar = async (req, res) => {
  try {
    const scholar = await ScholarSession.findByIdAndDelete(req.params.id);
    if (!scholar) {
      return res.status(404).json({ success: false, message: 'Scholar not found' });
    }
    res.json({ success: true, message: 'Scholar deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete scholar', error: err.message });
  }
}; 