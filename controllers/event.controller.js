const Event = require('../models/event.model');
const User = require('../models/user.model');
const nodemailer = require('nodemailer');

const eventController = {
  // Get all events
  getAllEvents: async (req, res) => {
    try {
      const events = await Event.find().populate('createdBy', 'username');
      res.json({
        success: true,
        data: events,
        message: 'Events fetched successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Get single event
  getEventById: async (req, res) => {
    try {
      const event = await Event.findById(req.params.id).populate('createdBy', 'username');
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }
      res.json({
        success: true,
        data: event,
        message: 'Event fetched successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },





  // Admin only version
  /*
  createEvent: async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only admins can create events'
        });
      }
  
      const newEvent = new Event({
        ...req.body,
        createdBy: req.user._id
      });
  
      const savedEvent = await newEvent.save();
      res.status(201).json({
        success: true,
        data: savedEvent,
        message: 'Event created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },
  */









  // Create new event (any authenticated user)
  createEvent: async (req, res) => {
    try {
      // Check if user exists in request (authenticated)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Please login to create events'
        });
      }

      const { title, description, date, startTime, endTime, city, location } = req.body;

      const newEvent = new Event({
        title,
        description,
        date,
        startTime,
        endTime,
        city,
        location,
        createdBy: req.user._id
      });

      const savedEvent = await newEvent.save();

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

          // Format the event date
          const eventDate = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          // Create email template
          const emailPromises = users.map(user => {
            const mailData = {
              from: process.env.SENDER,
              to: user.email,
              subject: `New Event Added: ${title}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                  <h2 style="color: #2c5530; text-align: center;">🎉 New Event Added!</h2>
                  
                  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2c5530; margin-top: 0;">${title}</h3>
                    <p style="color: #666; margin: 10px 0;"><strong>📅 Date:</strong> ${eventDate}</p>
                    <p style="color: #666; margin: 10px 0;"><strong>🕐 Time:</strong> ${startTime} - ${endTime}</p>
                    <p style="color: #666; margin: 10px 0;"><strong>📍 Location:</strong> ${location}, ${city}</p>
                  </div>
                  
                  <p style="color: #666;">Dear ${user.username},</p>
                  <p style="color: #666;">We're excited to announce a new event has been added to Islamic Sphere platform! Don't miss this opportunity to join our community.</p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:3001/events" style="background-color: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Event Details</a>
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
          console.log(`Email notifications sent to ${users.length} users for new event: ${title}`);
        }
      } catch (emailError) {
        // Log email error but don't fail the event creation
        console.error('Error sending email notifications:', emailError);
      }

      res.status(201).json({
        success: true,
        data: savedEvent,
        message: 'Event created successfully and notifications sent'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Update event (admin only)
  //   updateEvent: async (req, res) => {
  //     try {
  //       // Check if user is admin
  //       if (!req.user.isAdmin) {
  //         return res.status(403).json({
  //           success: false,
  //           message: 'Only admins can update events'
  //         });
  //       }

  //       const updatedEvent = await Event.findByIdAndUpdate(
  //         req.params.id,
  //         req.body,
  //         { new: true }
  //       );

  //       if (!updatedEvent) {
  //         return res.status(404).json({
  //           success: false,
  //           message: 'Event not found'
  //         });
  //       }

  //       res.json({
  //         success: true,
  //         data: updatedEvent,
  //         message: 'Event updated successfully'
  //       });
  //     } catch (error) {
  //       res.status(500).json({
  //         success: false,
  //         message: error.message
  //       });
  //     }
  //   },

  // for user
  updateEvent: async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user) {
        return res.status(403).json({
          success: false,
          message: 'Only admins can update events'
        });
      }

      const { title, description, date, startTime, endTime, city, location } = req.body;

      const updatedEvent = await Event.findByIdAndUpdate(
        req.params.id,
        { title, description, date, startTime, endTime, city, location },
        { new: true, runValidators: true }
      );

      if (!updatedEvent) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      res.json({
        success: true,
        data: updatedEvent,
        message: 'Event updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },












  // Delete event (admin only)
  //   deleteEvent: async (req, res) => {
  //     try {
  //       // Check if user is admin
  //       if (!req.user.isAdmin) {
  //         return res.status(403).json({
  //           success: false,
  //           message: 'Only admins can delete events'
  //         });
  //       }

  //       const deletedEvent = await Event.findByIdAndDelete(req.params.id);

  //       if (!deletedEvent) {
  //         return res.status(404).json({
  //           success: false,
  //           message: 'Event not found'
  //         });
  //       }

  //       res.json({
  //         success: true,
  //         message: 'Event deleted successfully'
  //       });
  //     } catch (error) {
  //       res.status(500).json({
  //         success: false,
  //         message: error.message
  //       });
  //     }
  //   }


  //user 



  deleteEvent: async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user) {
        return res.status(403).json({
          success: false,
          message: 'Only admins can delete events'
        });
      }

      const deletedEvent = await Event.findByIdAndDelete(req.params.id);

      if (!deletedEvent) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      res.json({
        success: true,
        message: 'Event deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }




};

module.exports = eventController;