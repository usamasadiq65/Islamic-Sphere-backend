const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CONFIG = require('../config');
const nodemailer = require('nodemailer');
const getUserResponse = (user) => {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    bio: user.bio,
    role: user.role,
    image: user.image,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
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

    // Find user by email or username
    let user;
    if (email) {
      user = await User.findOne({ email });
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
      bio
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
      bio
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

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        username,
        email,
        firstName,
        lastName,
        role,
        phone,
        bio,
        image
      },
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

// Add to module.exports
module.exports = {
  registerUser,
  loginUser,
  checkToken,
  updateUserProfile,
  // getResetCode,
  resetPassword,
  deleteUser,
  getUserById,
  getAllUsers,
  updateUserById,
  forgotPassword,
  verifyEmail,
  resendVerificationCode
};
