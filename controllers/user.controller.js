const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CONFIG = require('../config');
const nodemailer = require('nodemailer');

// Twilio SMS client
const twilio = require('twilio');
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const getUserResponse = (user) => {
  const response = {
    id: user._id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    phoneCountryCode: user.phoneCountryCode || '',
    isPhoneVerified: user.isPhoneVerified || false,
    bio: user.bio,
    role: user.role,
    image: user.image,
    lastLogin: user.lastLogin,
    secondaryEmails: user.secondaryEmails || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  // Include scholarInfo for scholars
  if (user.role === 'scholar') {
    response.scholarInfo = {
      specialty: user.scholarInfo?.specialty || '',
      availability: user.scholarInfo?.availability || '',
      languages: user.scholarInfo?.languages || [],
      certifications: user.scholarInfo?.certifications || [],
      rating: user.scholarInfo?.rating || 0
    };
  }

  return response;
}

// Register a new user
const registerUser = async (req, res) => {
  try {
    const { username, email, password, role, firstName, lastName, phone } = req.body;
    
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists',
        data: null,
        error: 'User already exists'
      });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        message: 'Username already exists',
        data: null,
        error: 'Username already exists'
      });
    }

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

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

    // Email to user
    const mailData = {
      from: process.env.SENDER,
      to: email,
      subject: "Email Verification Code",
      html: `
        <h3>Email Verification Code</h3>
        <p><strong>Name:</strong> ${username}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Verification Code:</strong> ${verificationCode}</p>
      `,
    };

    // Send email
    await transporter.sendMail(mailData);

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      role,
      firstName: firstName || '',
      lastName: lastName || '',
      phone: phone || '',
      verificationCode
    });

    const token = jwt.sign({ id: newUser._id }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRATION });
    const tokenExpiry = new Date(Date.now() + parseInt(CONFIG.JWT_EXPIRATION) * 1000);

    return res.status(201).json({
      message: 'User registered successfully. Please check your email for verification.',
      data: { user: getUserResponse(newUser), token, tokenExpiry },
      error: null
    });

  } catch (error) {
    console.error("Error in registration process:", error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};











//     const hashedPassword = await bcrypt.hash(password, 10);
//     const newUser = await User.create({
//       username,
//       email,
//       password: hashedPassword,
//       role,
//       firstName: firstName || '',
//       lastName: lastName || '',
//       phone: phone || ''
//     });

//     const token = jwt.sign({ id: newUser._id }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRATION });
//     const tokenExpiry = new Date(Date.now() + parseInt(CONFIG.JWT_EXPIRATION) * 1000);

//     return res.status(201).json({
//       message: 'User registered successfully',
//       data: { user: getUserResponse(newUser), token, tokenExpiry },
//       error: null
//     });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({
//       message: 'Server error',
//       data: null,
//       error: err.message
//     });
//   }
// };

// Log in an existing user
async function loginUser(req, res) {
  try {
    const { email, username, password } = req.body;

    // Find user by email (primary or verified secondary) or username
    let user;
    if (email) {
      // First try to find by primary email
      user = await User.findOne({ email });
      
      // If not found, search in verified secondary emails
      if (!user) {
        user = await User.findOne({
          'secondaryEmails': {
            $elemMatch: {
              email: email,
              isVerified: true
            }
          }
        });
      }
    } else if (username) {
      user = await User.findOne({ username });
    } else {
      return res.status(400).json({
        message: 'Email or username is required',
        data: null,
        error: 'Email or username is required'
      });
    }

    if (!user) {
      return res.status(404).json({
        message: 'Invalid credentials',
        data: null,
        error: 'Invalid credentials'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: 'Invalid credentials',
        data: null,
        error: 'Invalid credentials'
      });
    }

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email first',
        data: null,
        error: 'Email not verified'
      });
    }

    // Prevent admin users from logging into user panel
    if (user.role === 'admin') {
      return res.status(403).json({
        message: 'Admin accounts cannot login to user panel. Please use the admin panel.',
        data: null,
        error: 'Access denied'
      });
    }

    const token = jwt.sign({ id: user._id }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRATION });
    const tokenExpiry = new Date(Date.now() + parseInt(CONFIG.JWT_EXPIRATION) * 1000);

    user.lastLogin = new Date();
    await user.save();

    return res.status(200).json({
      message: 'Login successful',
      data: {
        token,
        user: getUserResponse(user),
        tokenExpiry
      },
      error: null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: err.message
    });
  }
}

// Admin Login - Only allows admin users
async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email is required',
        data: null,
        error: 'Email is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: 'Invalid credentials',
        data: null,
        error: 'Invalid credentials'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: 'Invalid credentials',
        data: null,
        error: 'Invalid credentials'
      });
    }

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email first',
        data: null,
        error: 'Email not verified'
      });
    }

    // Only allow admin users
    if (user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied. Only administrators can access this panel.',
        data: null,
        error: 'Access denied'
      });
    }

    const token = jwt.sign({ id: user._id }, CONFIG.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRATION });
    const tokenExpiry = new Date(Date.now() + parseInt(CONFIG.JWT_EXPIRATION) * 1000);

    user.lastLogin = new Date();
    await user.save();

    return res.status(200).json({
      message: 'Login successful',
      data: {
        token,
        user: getUserResponse(user),
        tokenExpiry
      },
      error: null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: err.message
    });
  }
}

const checkToken = async (req, res) => {
  if (req.user) {
    return res.status(200).json({ message: 'Token is valid', data: { user: getUserResponse(req.user) }, error: null });
  }

  return res.status(401).json({ message: 'Unauthorized', data: null, error: 'Unauthorized' });
};

// Update the user's profile
const updateUserProfile = async (req, res) => {
  try {
    const {
      username,
      email,
      firstName,
      lastName,
      phone,
      image,
      bio,
      scholarInfo
    } = req.body;

    const emailCheck = await User.findOne({ email });
    if (emailCheck && emailCheck._id.toString() !== req.user.id) return res.status(400).json({ message: 'Email already exists', data: null, error: 'Email already exists' });

    const usernameCheck = await User.findOne({ username });
    if (usernameCheck && usernameCheck._id.toString() !== req.user.id) return res.status(400).json({ message: 'Username already exists', data: null, error: 'Username already exists' });

    // Create update object
    const updateData = {
      username,
      email,
      firstName,
      lastName,
      phone,
      bio
    };

    // Handle image update/deletion
    if (image === null || image === '') {
      // If image is null or empty string, remove the image
      updateData.image = undefined;
    } else if (image) {
      // If new image is provided, update it
      updateData.image = image;
    }
    // If image is not in the request, keep existing image

    // Handle scholar-specific fields if user is a scholar
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role === 'scholar' && scholarInfo) {
      updateData.scholarInfo = {
        specialty: scholarInfo.specialty || '',
        availability: scholarInfo.availability || '',
        languages: scholarInfo.languages || [],
        certifications: scholarInfo.certifications || []
      };
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({
      message: 'User not found',
      data: null,
      error: 'User not found'
    });

    return res.status(200).json({
      message: 'Profile updated',
      data: { user: getUserResponse(updatedUser) },
      error: null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', data: null, error: err.message });
  }
};

// const getResetCode = async (req, res) => {
//   try {
//     const { email } = req.body;
//     const user = await User.findOne({ email });
//     if (!user) return res.status(404).json({ message: 'User not found', data: null, error: 'User not found' });

//     if (user.resetCodeExpiry && user.resetCodeExpiry > new Date()) {
//       return res.status(400).json({ message: 'Reset code already sent', data: null, error: 'Reset code already sent' });
//     }

//     const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
//     user.resetCode = resetCode;
//     user.resetCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
//     await user.save();

//     return res.status(200).json({ message: 'Reset code sent', data: { resetCode }, error: null });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: 'Server error', data: null, error: err.message });
//   }
// };

const resetPassword = async (req, res) => {
  try {
    const { resetCode, password, confirmPassword } = req.body;

    // Validate passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        message: 'Passwords do not match',
        data: null,
        error: 'Passwords do not match'
      });
    }

    // Find user with reset code
    const user = await User.findOne({ resetCode });
    if (!user) {
      return res.status(404).json({
        message: 'Invalid reset code',
        data: null,
        error: 'Invalid or expired reset code'
      });
    }

    // Check if reset code has expired
    if (!user.resetCodeExpiry || user.resetCodeExpiry < new Date()) {
      return res.status(400).json({
        message: 'Reset code has expired',
        data: null,
        error: 'Reset code has expired'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user's password and clear reset code fields
    user.password = hashedPassword;
    user.resetCode = undefined;
    user.resetCodeExpiry = undefined;
    await user.save();

    return res.status(200).json({
      message: 'Password reset successfully',
      data: null,
      error: null
    });

  } catch (error) {
    console.error("Error in reset password process:", error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        data: null,
        error: 'User not found'
      });
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      message: 'User deleted successfully',
      data: null,
      error: null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: err.message
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password');  // Exclude password field
    
    return res.status(200).json({
      message: 'Users fetched successfully',
      data: users.map(user => getUserResponse(user)),
      error: null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: err.message
    });
  }
};

// Get all users with role 'scholar'
const getScholars = async (req, res) => {
  try {
    const scholars = await User.find({ role: 'scholar' }, '-password');
    
    // Transform scholar data to match the expected format for the frontend
    const scholarData = scholars.map(scholar => ({
      _id: scholar._id,
      username: scholar.username,
      email: scholar.email,
      firstName: scholar.firstName || '',
      lastName: scholar.lastName || '',
      name: `${scholar.firstName || ''} ${scholar.lastName || ''}`.trim() || scholar.username,
      specialty: scholar.scholarInfo?.specialty || 'Islamic Studies',
      rating: scholar.scholarInfo?.rating || 0, // Rating set by admin
      image: scholar.image || '',
      bio: scholar.bio || '',
      availability: scholar.scholarInfo?.availability || 'Contact for availability',
      languages: scholar.scholarInfo?.languages || [],
      certifications: scholar.scholarInfo?.certifications || [],
      sessions: 0, // Can be populated later
      students: 0, // Can be populated later
      userId: scholar._id // Reference to the user
    }));
    
    return res.status(200).json({
      success: true,
      message: 'Scholars fetched successfully',
      data: scholarData
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      data: null,
      error: err.message
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId, '-password');
    
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        data: null,
        error: 'User not found'
      });
    }

    return res.status(200).json({
      message: 'User fetched successfully',
      data: getUserResponse(user),
      error: null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: err.message
    });
  }
};

const updateUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    const {
      username,
      email,
      firstName,
      lastName,
      role,
      phone,
      image,
      bio,
      scholarInfo
    } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        data: null,
        error: 'User not found'
      });
    }

    // Check if email is already taken by another user
    const emailCheck = await User.findOne({ email });
    if (emailCheck && emailCheck._id.toString() !== userId) {
      return res.status(400).json({
        message: 'Email already exists',
        data: null,
        error: 'Email already exists'
      });
    }

    // Check if username is already taken by another user
    const usernameCheck = await User.findOne({ username });
    if (usernameCheck && usernameCheck._id.toString() !== userId) {
      return res.status(400).json({
        message: 'Username already exists',
        data: null,
        error: 'Username already exists'
      });
    }

    // Build update object
    const updateData = {
      username,
      email,
      firstName,
      lastName,
      role,
      phone,
      bio,
      image
    };

    // Include scholarInfo if user is a scholar and scholarInfo is provided
    if (role === 'scholar' && scholarInfo) {
      updateData.scholarInfo = {
        specialty: scholarInfo.specialty || user.scholarInfo?.specialty || '',
        availability: scholarInfo.availability || user.scholarInfo?.availability || '',
        languages: scholarInfo.languages || user.scholarInfo?.languages || [],
        certifications: scholarInfo.certifications || user.scholarInfo?.certifications || [],
        rating: scholarInfo.rating !== undefined ? scholarInfo.rating : (user.scholarInfo?.rating || 0)
      };
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    return res.status(200).json({
      message: 'User updated successfully',
      data: getUserResponse(updatedUser),
      error: null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: err.message
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        data: null,
        error: 'User with this email does not exist'
      });
    }

    // Generate reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

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

    // Email template
    const mailData = {
      from: process.env.SENDER,
      to: email,
      subject: "Password Reset Code",
      html: `
        <h3>Password Reset Request</h3>
        <p>Hello ${user.username},</p>
        <p>You have requested to reset your password. Here is your reset code:</p>
        <h2 style="background: #f4f4f4; padding: 10px;">${resetCode}</h2>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    };

    // Send email
    await transporter.sendMail(mailData);

    // Save reset code and expiry to user document
    user.resetCode = resetCode;
    user.resetCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    await user.save();

    return res.status(200).json({
      message: 'Reset code sent successfully. Please check your email.',
      data: null,
      error: null
    });

  } catch (error) {
    console.error("Error in forgot password process:", error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { verificationCode } = req.body;

    // Find user with verification code
    const user = await User.findOne({ verificationCode });
    
    if (!user) {
      return res.status(404).json({
        message: 'Invalid verification code',
        data: null,
        error: 'Invalid verification code'
      });
    }

    // Update user's verification status
    user.isVerified = true;
    user.verificationCode = undefined; // Clear verification code
    await user.save();

    return res.status(200).json({
      message: 'Email verified successfully',
      data: null,
      error: null
    });

  } catch (error) {
    console.error("Error in email verification process:", error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Resend verification code
const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        data: null,
        error: 'User not found with this email'
      });
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Update user with new verification code
    user.verificationCode = verificationCode;
    await user.save();

    // Send verification email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SENDER,
        pass: process.env.PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.SENDER,
      to: email,
      subject: 'New Verification Code',
      text: `Your new verification code is: ${verificationCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Verification</h2>
          <p>Hello ${user.username},</p>
          <p>Here is your new verification code:</p>
          <h1 style="text-align: center; letter-spacing: 5px; font-size: 32px; margin: 20px 0;">${verificationCode}</h1>
          <p>Please enter this code in the verification page to complete your registration.</p>
          <p>If you didn't request this code, you can safely ignore this email.</p>
          <p>Best regards,<br>Your App Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: 'New verification code sent successfully',
      data: null,
      error: null
    });
  } catch (error) {
    console.error("Error in resend verification code process:", error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Change Password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        message: 'All fields are required',
        data: null,
        error: 'Current password, new password and confirm password are required'
      });
    }

    // Check if new passwords match
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        message: 'New passwords do not match',
        data: null,
        error: 'New password and confirm password must match'
      });
    }

    // Validate password strength (at least 6 characters)
    if (newPassword.length < 6) {
      return res.status(400).json({
        message: 'Password too weak',
        data: null,
        error: 'New password must be at least 6 characters long'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        data: null,
        error: 'User not found'
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: 'Current password is incorrect',
        data: null,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      message: 'Password changed successfully',
      data: null,
      error: null
    });

  } catch (error) {
    console.error("Error in change password process:", error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Add Secondary Email
const addSecondaryEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.id;

    // Validate email
    if (!email) {
      return res.status(400).json({
        message: 'Email is required',
        data: null,
        error: 'Email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Invalid email format',
        data: null,
        error: 'Please provide a valid email address'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        data: null,
        error: 'User not found'
      });
    }

    // Check if email is the primary email
    if (user.email.toLowerCase() === email.toLowerCase()) {
      return res.status(400).json({
        message: 'This is already your primary email',
        data: null,
        error: 'Cannot add primary email as secondary'
      });
    }

    // Check if email already exists as secondary email for this user
    const existingSecondary = user.secondaryEmails?.find(
      se => se.email.toLowerCase() === email.toLowerCase()
    );
    if (existingSecondary) {
      return res.status(400).json({
        message: 'Email already added as secondary email',
        data: null,
        error: 'This email is already in your secondary emails list'
      });
    }

    // Check if email exists for another user (primary or secondary)
    const emailExistsAsPrimary = await User.findOne({ email: email.toLowerCase() });
    if (emailExistsAsPrimary) {
      return res.status(400).json({
        message: 'Email already in use',
        data: null,
        error: 'This email is already registered to another account'
      });
    }

    const emailExistsAsSecondary = await User.findOne({
      'secondaryEmails.email': email.toLowerCase(),
      _id: { $ne: userId }
    });
    if (emailExistsAsSecondary) {
      return res.status(400).json({
        message: 'Email already in use',
        data: null,
        error: 'This email is already registered to another account'
      });
    }

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

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

    // Email verification
    const mailData = {
      from: process.env.SENDER,
      to: email,
      subject: "Secondary Email Verification Code",
      html: `
        <h3>Secondary Email Verification</h3>
        <p>You are adding this email as a secondary email to your account.</p>
        <p><strong>Verification Code:</strong> ${verificationCode}</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    };

    // Send email
    await transporter.sendMail(mailData);

    // Add secondary email to user
    if (!user.secondaryEmails) {
      user.secondaryEmails = [];
    }
    
    user.secondaryEmails.push({
      email: email.toLowerCase(),
      isVerified: false,
      verificationCode,
      addedAt: new Date()
    });

    await user.save();

    return res.status(200).json({
      message: 'Secondary email added. Please check your email for verification code.',
      data: { user: getUserResponse(user) },
      error: null
    });

  } catch (error) {
    console.error("Error in add secondary email process:", error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Verify Secondary Email
const verifySecondaryEmail = async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    const userId = req.user.id;

    if (!email || !verificationCode) {
      return res.status(400).json({
        message: 'Email and verification code are required',
        data: null,
        error: 'Missing required fields'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        data: null,
        error: 'User not found'
      });
    }

    // Find the secondary email
    const secondaryEmailIndex = user.secondaryEmails?.findIndex(
      se => se.email.toLowerCase() === email.toLowerCase()
    );

    if (secondaryEmailIndex === -1 || secondaryEmailIndex === undefined) {
      return res.status(404).json({
        message: 'Secondary email not found',
        data: null,
        error: 'This email is not in your secondary emails list'
      });
    }

    const secondaryEmail = user.secondaryEmails[secondaryEmailIndex];

    // Check verification code
    if (secondaryEmail.verificationCode !== verificationCode) {
      return res.status(400).json({
        message: 'Invalid verification code',
        data: null,
        error: 'The verification code is incorrect'
      });
    }

    // Mark as verified
    user.secondaryEmails[secondaryEmailIndex].isVerified = true;
    user.secondaryEmails[secondaryEmailIndex].verificationCode = undefined;
    await user.save();

    return res.status(200).json({
      message: 'Secondary email verified successfully',
      data: { user: getUserResponse(user) },
      error: null
    });

  } catch (error) {
    console.error("Error in verify secondary email process:", error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Remove Secondary Email
const removeSecondaryEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.id;

    if (!email) {
      return res.status(400).json({
        message: 'Email is required',
        data: null,
        error: 'Email is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        data: null,
        error: 'User not found'
      });
    }

    // Check if trying to remove primary email
    if (user.email.toLowerCase() === email.toLowerCase()) {
      return res.status(400).json({
        message: 'Cannot remove primary email',
        data: null,
        error: 'Primary email cannot be removed. You can only remove secondary emails.'
      });
    }

    // Find and remove the secondary email
    const secondaryEmailIndex = user.secondaryEmails?.findIndex(
      se => se.email.toLowerCase() === email.toLowerCase()
    );

    if (secondaryEmailIndex === -1 || secondaryEmailIndex === undefined) {
      return res.status(404).json({
        message: 'Secondary email not found',
        data: null,
        error: 'This email is not in your secondary emails list'
      });
    }

    user.secondaryEmails.splice(secondaryEmailIndex, 1);
    await user.save();

    return res.status(200).json({
      message: 'Secondary email removed successfully',
      data: { user: getUserResponse(user) },
      error: null
    });

  } catch (error) {
    console.error("Error in remove secondary email process:", error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Resend Secondary Email Verification Code
const resendSecondaryEmailCode = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.id;

    if (!email) {
      return res.status(400).json({
        message: 'Email is required',
        data: null,
        error: 'Email is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        data: null,
        error: 'User not found'
      });
    }

    // Find the secondary email
    const secondaryEmailIndex = user.secondaryEmails?.findIndex(
      se => se.email.toLowerCase() === email.toLowerCase()
    );

    if (secondaryEmailIndex === -1 || secondaryEmailIndex === undefined) {
      return res.status(404).json({
        message: 'Secondary email not found',
        data: null,
        error: 'This email is not in your secondary emails list'
      });
    }

    const secondaryEmail = user.secondaryEmails[secondaryEmailIndex];

    if (secondaryEmail.isVerified) {
      return res.status(400).json({
        message: 'Email already verified',
        data: null,
        error: 'This secondary email is already verified'
      });
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

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

    // Email verification
    const mailData = {
      from: process.env.SENDER,
      to: email,
      subject: "Secondary Email Verification Code",
      html: `
        <h3>Secondary Email Verification</h3>
        <p>You are adding this email as a secondary email to your account.</p>
        <p><strong>Verification Code:</strong> ${verificationCode}</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    };

    // Send email
    await transporter.sendMail(mailData);

    // Update verification code
    user.secondaryEmails[secondaryEmailIndex].verificationCode = verificationCode;
    await user.save();

    return res.status(200).json({
      message: 'Verification code resent successfully',
      data: null,
      error: null
    });

  } catch (error) {
    console.error("Error in resend secondary email code process:", error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Send phone verification code
const sendPhoneVerificationCode = async (req, res) => {
  try {
    const { phone, countryCode } = req.body;
    const userId = req.user.id;

    if (!phone || !countryCode) {
      return res.status(400).json({
        message: 'Phone number and country code are required',
        data: null,
        error: 'Missing required fields'
      });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[0-9]{6,15}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        message: 'Invalid phone number format',
        data: null,
        error: 'Invalid phone number'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        data: null,
        error: 'User not found'
      });
    }

    // Check if this phone is already verified by another user
    const fullPhone = `${countryCode}${phone}`;
    const existingUser = await User.findOne({
      phone: phone,
      phoneCountryCode: countryCode,
      isPhoneVerified: true,
      _id: { $ne: userId }
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'This phone number is already registered to another account',
        data: null,
        error: 'Phone already in use'
      });
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry to 10 minutes from now
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000);

    // Update user with verification code
    user.phone = phone;
    user.phoneCountryCode = countryCode;
    user.phoneVerificationCode = verificationCode;
    user.phoneVerificationExpiry = expiryTime;
    user.isPhoneVerified = false;
    await user.save();

    // Log the code for development
    console.log(`[DEV] Phone verification code for ${countryCode}${phone}: ${verificationCode}`);

    // Send SMS via Twilio if configured
    let smsSent = false;
    if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: `Your Islamic Sphere verification code is: ${verificationCode}. Valid for 10 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `${countryCode}${phone}`
        });
        smsSent = true;
        console.log(`[SMS] Verification code sent to ${countryCode}${phone}`);
      } catch (smsError) {
        console.error('[SMS ERROR]', smsError.message);
        // Continue even if SMS fails - we'll show the code in response for dev
      }
    }

    return res.status(200).json({
      message: smsSent ? 'Verification code sent to your phone!' : 'Verification code generated',
      data: { 
        phone,
        countryCode,
        // For development - return code if SMS wasn't sent (REMOVE IN PRODUCTION!)
        devCode: !smsSent ? verificationCode : undefined
      },
      error: null
    });

  } catch (error) {
    console.error("Error sending phone verification code:", error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Verify phone number with code
const verifyPhoneNumber = async (req, res) => {
  try {
    const { verificationCode } = req.body;
    const userId = req.user.id;

    if (!verificationCode) {
      return res.status(400).json({
        message: 'Verification code is required',
        data: null,
        error: 'Missing verification code'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        data: null,
        error: 'User not found'
      });
    }

    // Check if verification code exists
    if (!user.phoneVerificationCode) {
      return res.status(400).json({
        message: 'No verification code found. Please request a new code.',
        data: null,
        error: 'No pending verification'
      });
    }

    // Check if code has expired
    if (user.phoneVerificationExpiry < new Date()) {
      return res.status(400).json({
        message: 'Verification code has expired. Please request a new code.',
        data: null,
        error: 'Code expired'
      });
    }

    // Check if code matches
    if (user.phoneVerificationCode !== verificationCode) {
      return res.status(400).json({
        message: 'Invalid verification code',
        data: null,
        error: 'Invalid code'
      });
    }

    // Mark phone as verified
    user.isPhoneVerified = true;
    user.phoneVerificationCode = undefined;
    user.phoneVerificationExpiry = undefined;
    await user.save();

    return res.status(200).json({
      message: 'Phone number verified successfully',
      data: { user: getUserResponse(user) },
      error: null
    });

  } catch (error) {
    console.error("Error verifying phone number:", error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Remove/unverify phone number
const removePhoneNumber = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        data: null,
        error: 'User not found'
      });
    }

    // Clear phone data
    user.phone = '';
    user.phoneCountryCode = '';
    user.isPhoneVerified = false;
    user.phoneVerificationCode = undefined;
    user.phoneVerificationExpiry = undefined;
    await user.save();

    return res.status(200).json({
      message: 'Phone number removed successfully',
      data: { user: getUserResponse(user) },
      error: null
    });

  } catch (error) {
    console.error("Error removing phone number:", error);
    return res.status(500).json({
      message: 'Server error',
      data: null,
      error: error.message
    });
  }
};

// Add to module.exports
module.exports = {
  registerUser,
  loginUser,
  adminLogin,
  checkToken,
  updateUserProfile,
  // getResetCode,
  resetPassword,
  deleteUser,
  getUserById,
  getAllUsers,
  getScholars,
  updateUserById,
  forgotPassword,
  verifyEmail,
  resendVerificationCode,
  changePassword,
  addSecondaryEmail,
  verifySecondaryEmail,
  removeSecondaryEmail,
  resendSecondaryEmailCode,
  sendPhoneVerificationCode,
  verifyPhoneNumber,
  removePhoneNumber
};
