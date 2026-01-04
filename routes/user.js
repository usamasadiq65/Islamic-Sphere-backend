const express = require('express');
const router = express.Router();
const authorize = require('../middlewares/authorization');
const {
  registerUser,
  loginUser,
  adminLogin,
  checkToken,
  updateUserProfile,
  deleteUser,
  getAllUsers,
  getScholars,
  getUserById,
  forgotPassword,
  resetPassword,
  updateUserById,
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
} = require('../controllers/user.controller');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/admin/login', adminLogin);

// router.post('/reset-code', getResetCode);
// router.post('/reset-password', resetPassword);

router.put('/profile', authorize, updateUserProfile);
router.get('/check-token', authorize, checkToken);

// Get all scholars (users with role 'scholar') - public route
router.get('/scholars', getScholars);

// Change Password route (protected)
router.post('/change-password', authorize, changePassword);

// Secondary Email routes (protected)
router.post('/secondary-email', authorize, addSecondaryEmail);
router.post('/secondary-email/verify', authorize, verifySecondaryEmail);
router.delete('/secondary-email', authorize, removeSecondaryEmail);
router.post('/secondary-email/resend-code', authorize, resendSecondaryEmailCode);

// Phone verification routes (protected)
router.post('/phone/send-code', authorize, sendPhoneVerificationCode);
router.post('/phone/verify', authorize, verifyPhoneNumber);
router.delete('/phone', authorize, removePhoneNumber);

// Delete user route (protected)
router.delete('/:id', authorize, deleteUser);

// Get all users (protected route)
router.get('/', authorize, getAllUsers);

// Add new route for getting user by ID
router.get('/:id', authorize, getUserById);

// Admin route to update user by ID
router.put('/admin/users/:id', authorize, updateUserById);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification-code', resendVerificationCode);

module.exports = router;

// http://localhost:3000/auth/register