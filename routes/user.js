const express = require('express');
const router = express.Router();
const authorize = require('../middlewares/authorization');
const {
  registerUser,
  loginUser,
  checkToken,
  updateUserProfile,
  deleteUser,
  getAllUsers,
  getUserById,
  forgotPassword,
  resetPassword,
  updateUserById,
  verifyEmail,
  resendVerificationCode
} = require('../controllers/user.controller');

router.post('/register', registerUser);
router.post('/login', loginUser);

// router.post('/reset-code', getResetCode);
// router.post('/reset-password', resetPassword);

router.put('/profile', authorize, updateUserProfile);
router.get('/check-token', authorize, checkToken);

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