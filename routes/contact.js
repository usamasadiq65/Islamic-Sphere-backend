const express = require('express');
const router = express.Router();
const authorize = require('../middlewares/authorization');
// const { isAdmin } = require('../middlewares/isAdmin');
const {
  getUsers,
  addContacts,
  getContacts,
  removeContact,
  approveUserRequest,
  getContactRequests,
  cancelContactRequest,
  getAllUsersWithContacts,
  updateUserAndContacts,
  deleteSingleContact,
  deleteUserContacts
} = require('../controllers/contact.controller');

// Search users
router.get('/users', authorize, getUsers);

// Manage contacts
router.route('/')
  .get(authorize, getContacts)
  .post(authorize, addContacts);

// Remove contact
router.delete('/', authorize, removeContact);

// Approve user request
router.post('/approve', authorize, approveUserRequest);

// Get contact requests
router.get('/requests', authorize, getContactRequests);

// Cancel contact request
router.delete('/cancel-request', authorize, cancelContactRequest);

// Admin routes
// router.get('/admin/users', [authorize, isAdmin], getAllUsersWithContacts);
// router.put('/admin/users/:userId', [authorize, isAdmin], updateUserAndContacts);
// router.delete('/admin/users/:userId', [authorize, isAdmin], deleteUserAndContacts);
router.get('/admin/users', authorize,  getAllUsersWithContacts);
router.put('/admin/users/:userId', authorize,  updateUserAndContacts);
router.delete('/admin/users/:userId/contacts', authorize, deleteUserContacts);
router.delete('/admin/users/:userId/contacts/:contactId', authorize, deleteSingleContact);


module.exports = router;