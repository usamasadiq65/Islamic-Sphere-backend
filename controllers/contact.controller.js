const Contact = require('../models/contact.model');
const User = require('../models/user.model');


// @desc    Get users by search query
// @route   GET /api/contacts/users
// @access  Private
const getUsers = async (req, res) => {
  try {
    const { search } = req.query;

    let query = {};
    if (search && search !== '') {
      query = {
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Search users by firstName, lastName, email, or phone number
    let users = await User.find(query);

    // Don't include the current user in search results
    const filteredUsers = users.filter(user =>
      user._id.toString() !== req.user._id.toString()
    );

    // Map the users to only include the necessary fields
    let mappedUsers = filteredUsers.map(user => {
      console.log(user);
      return {
        _id: user._id,
        username: user.username || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || ''
      }
    });

    res.status(200).json(mappedUsers);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add contacts to user's contact list (by IDs only)
// @route   POST /api/contacts
// @access  Private
const addContacts = async (req, res) => {
  try {
    const { contactIds } = req.body;

    if (!contactIds?.length) {
      return res.status(400).json({ message: 'Contact IDs are required' });
    }

    // Find or create contact document
    let contactDoc = await Contact.findOne({ user: req.user._id }) ||
      new Contact({ user: req.user._id, contacts: [] });

    const validContacts = [];
    const invalidContactIds = [];

    // Process each contact ID
    for (const contactId of contactIds) {
      // Find user by ID
      const user = await User.findById(contactId);

      if (!user) {
        invalidContactIds.push(contactId);
        continue;
      }

      // Skip if contact already exists
      if (contactDoc.contacts.some(c =>
        c.contactUser?.toString() === user._id.toString())) {
        continue;
      }

      // Add valid contact
      validContacts.push(contactId);
      contactDoc.contacts.push({
        contactUser: user._id,
        approved: false,
        dateAdded: new Date()
      });

      user.requests.push(contactDoc.user);

      await user.save();
    }


    await contactDoc.save();



    await Contact.populate(contactDoc, {
      path: 'contacts.contactUser'
    });

    res.status(201).json({
      contacts: contactDoc.contacts,
      added: validContacts.length,
      invalid: invalidContactIds.length,
      invalidContactIds: invalidContactIds.length > 0 ? invalidContactIds : undefined
    });
  } catch (error) {
    console.error('Error adding contacts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user's contacts
// @route   GET /api/contacts
// @access  Private
const getContacts = async (req, res) => {
  try {
    const contactDoc = await Contact.findOne({ user: req.user._id })
      .populate('contacts.contactUser');

    if (!contactDoc) {
      return res.status(200).json([]);
    }

    let contacts = contactDoc.contacts.map(contact => {
      return {
        _id: contact.contactUser._id,
        username: contact.contactUser.username,
        name: contact.contactUser.firstName + ' ' + contact.contactUser.lastName,
        email: contact.contactUser.email,
        phone: contact.contactUser.phone,
        approved: contact.approved,
        dateAdded: contact.dateAdded
      }
    });

    res.status(200).json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove contact from user's contact list
// @route   DELETE /api/contacts?contactId=xyz
// @access  Private
const removeContact = async (req, res) => {
  try {
    const { contactId } = req.query;

    if (!contactId) {
      return res.status(400).json({ message: 'Contact ID is required' });
    }

    let contactDoc = await Contact.findOne({ user: req.user._id });
    if (contactDoc) {
      contactDoc.contacts = contactDoc.contacts.filter(contact => contact.contactUser.toString() !== contactId.toString());
      await contactDoc.save();
    }

    let userContact = await Contact.findOne({ user: contactId });
    if (userContact) {
      userContact.contacts = userContact.contacts.filter(contact => contact.contactUser.toString() !== req.user._id.toString());
      await userContact.save();
    }

    return res.status(200).json({
      message: 'Contact removed successfully',
      contactId
    });
  } catch (error) {
    console.error('Error removing contact:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Approve or reject contact request
// @route   POST /api/contacts/approve
// @access  Private
const approveUserRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { requestsUserId, IsApproved } = req.body;

    const contactDoc = await Contact.findOne({ user: requestsUserId });

    if (!contactDoc) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const contact = contactDoc.contacts.find(contact => contact.contactUser.toString() === userId.toString());

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    if (contact.approved) {
      return res.status(400).json({ message: 'Contact already approved' });
    }

    if (IsApproved) {
      contactDoc.contacts = contactDoc.contacts.map(contact => {
        if (contact.contactUser.toString() === userId.toString()) {
          contact.approved = true;
        }
        return contact;
      });
      await contactDoc.save();

      user.requests = user.requests.filter(request => request.toString() !== requestsUserId.toString());
      await user.save();

      // also add to user contact if not already
      let userContact = await Contact.findOne({ user: userId });
      if (!userContact) {
        userContact = new Contact({ user: userId, contacts: [] });
      }
      if (!userContact.contacts.some(contact => contact.contactUser.toString() === requestsUserId.toString())) {
        userContact.contacts.push({
          contactUser: requestsUserId,
          approved: true,
          dateAdded: new Date()
        });
        await userContact.save();
      }
    } else {
      contactDoc.contacts = contactDoc.contacts.filter(contact => contact.contactUser.toString() !== userId.toString());
      await contactDoc.save();

      // also remove from user contact if exists
      let userContact = await Contact.findOne({ user: userId });
      if (userContact) {
        userContact.contacts = userContact.contacts.filter(contact => contact.contactUser.toString() !== userId.toString());
        await userContact.save();
      }

      user.requests = user.requests.filter(request => request.toString() !== requestsUserId.toString());
      await user.save();
    }

    await Contact.populate(contactDoc, {
      path: 'contacts.contactUser'
    });

    return res.status(200).json({ message: 'Contact approved successfully' });
  } catch (error) {
    console.error('Error approving contact:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getContactRequests = async (req, res) => {
  try {
    let user = await User.findById(req.user._id).populate('requests');
    let requests = user.requests.map(request => {
      return {
        _id: request._id,
        username: request.username,
        name: request.firstName + ' ' + request.lastName,
        email: request.email,
      }
    });
    return res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const cancelContactRequest = async (req, res) => {
  try {
    const { requestedUserId } = req.query;

    if (!requestedUserId) {
      return res.status(400).json({ message: 'Requested user ID is required' });
    }

    // Find the contact document of the current user
    let contactDoc = await Contact.findOne({ user: req.user._id });
    if (contactDoc) {
      // Remove the pending request from contacts
      contactDoc.contacts = contactDoc.contacts.filter(
        contact => contact.contactUser.toString() !== requestedUserId.toString()
      );
      await contactDoc.save();
    }

    // Remove the request from the requested user's requests array
    let requestedUser = await User.findById(requestedUserId);
    if (requestedUser) {
      requestedUser.requests = requestedUser.requests.filter(
        request => request.toString() !== req.user._id.toString()
      );
      await requestedUser.save();
    }

    return res.status(200).json({
      message: 'Contact request cancelled successfully',
      requestedUserId
    });
  } catch (error) {
    console.error('Error cancelling contact request:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users with their contacts (Admin only)
// @route   GET /api/contacts/admin/users
// @access  Admin
const getAllUsersWithContacts = async (req, res) => {
  try {
    // Get all users
    const users = await User.find({}).select('-password');
    
    // Get contacts for each user
    const usersWithContacts = await Promise.all(users.map(async user => {
      const contactDoc = await Contact.findOne({ user: user._id })
        .populate('contacts.contactUser', 'username email firstName lastName');
      
      return {
        _id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        contacts: contactDoc ? contactDoc.contacts : [],
        totalContacts: contactDoc ? contactDoc.contacts.length : 0
      };
    }));

    res.status(200).json({
      success: true,
      data: usersWithContacts,
      count: usersWithContacts.length
    });
  } catch (error) {
    console.error('Error fetching users with contacts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

// @desc    Update user and their contacts (Admin only)
// @route   PUT /api/contacts/admin/users/:userId
// @access  Admin
const updateUserAndContacts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userData, contacts } = req.body;

    // Update user data
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: userData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update contacts if provided
    if (contacts) {
      let contactDoc = await Contact.findOne({ user: userId });
      
      if (!contactDoc) {
        contactDoc = new Contact({ user: userId, contacts: [] });
      }

      contactDoc.contacts = contacts;
      await contactDoc.save();
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

// @desc    Delete user and their contacts (Admin only)
// @route   DELETE /api/contacts/admin/users/:userId
// @access  Admin


// @desc    Delete user contacts
// @route   DELETE /api/contacts/admin/users/:userId/contacts
// @access  Admin
const deleteUserContacts = async (req, res) => {
  try {
    const { userId } = req.params;

    // First verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete user's contacts document
    await Contact.deleteOne({ user: userId });

    // Remove user from others' contacts
    await Contact.updateMany(
      { 'contacts.contactUser': userId },
      { $pull: { contacts: { contactUser: userId } } }
    );

    res.status(200).json({
      success: true,
      message: 'User contacts deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting contacts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

// @desc    Delete single contact
// @route   DELETE /api/contacts/admin/users/:userId/contacts/:contactId
// @access  Admin
const deleteSingleContact = async (req, res) => {
  try {
    const { userId, contactId } = req.params;

    // First verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove single contact from user's contacts
    await Contact.updateOne(
      { user: userId },
      { $pull: { contacts: { contactUser: contactId } } }
    );

    // Remove user from the contact's contacts list
    await Contact.updateOne(
      { user: contactId },
      { $pull: { contacts: { contactUser: userId } } }
    );

    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

module.exports = {
  getUsers,
  addContacts,
  getContacts,
  removeContact,
  approveUserRequest,
  getContactRequests,
  cancelContactRequest,
  getAllUsersWithContacts,
  updateUserAndContacts,
  deleteUserContacts,
  deleteSingleContact
};