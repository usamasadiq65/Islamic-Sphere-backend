const CONFIG = require('../config');
const User = require('../models/user.model');
const Group = require('../models/group.model');
const Task = require('../models/task.model');
const Poll = require('../models/poll.model');
const UserTaskList = require('../models/userTaskList.model');
const TaskProgress = require('../models/taskProgress.model');
const moment = require('moment');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const { getOrCreateGroupChannel, deleteGroupChannel } = require('./stream.controller');

const defaultTasks = [
]

const defaultPolls = [
]

// Create a new group
const createGroup = async (req, res) => {
  try {
    const { name, description, image, members } = req.body;

    if (!req.user) {
      return res.status(401).json({
        message: 'Failed to create group',
        data: null,
        error: 'User not authenticated'
      });
    }

    const owner = req.user._id || req.user.id;

    if (!owner) {
      return res.status(401).json({
        message: 'Failed to create group',
        data: null,
        error: 'User ID not found'
      });
    }

    if (!name) {
      return res.status(400).json({
        message: 'Failed to create group',
        data: null,
        error: 'Name is required'
      });
    }

    // Initialize members array with just the owner
    let group = new Group({
      name,
      description,
      image,
      owner,
      owners: [], // Additional owners (empty initially, owner field is the super owner)
      members: [owner.toString()], // Start with just the owner
      tasks: [],
      polls: []
    });

    // If additional members were provided, verify and add them
    if (members && members.length > 0) {
      // Find all users that match the provided usernames/emails
      const memberUsers = await User.find({
        $or: [
          { username: { $in: members } },
          { email: { $in: members } }
        ]
      });

      // Add their IDs to the group members
      if (memberUsers.length > 0) {
        memberUsers.forEach(user => {
          if (!group.members.includes(user._id.toString())) {
            group.members.push(user._id.toString());
          }
        });
      }
    }

    // Save initial group
    group = await group.save();

    // Add default tasks
    for (const task of defaultTasks) {
      let newTask = new Task({
        title: task.title,
        description: task.description,
        deadline: task.deadline,
        group: group._id,
      });
      newTask = await newTask.save();
      group.tasks.push(newTask._id);
    }

    // Add default polls
    for (const poll of defaultPolls) {
      let newPoll = new Poll({
        title: poll.title,
        options: poll.options,
        isCustom: poll.isCustom,
        deadline: poll.deadline,
        group: group._id,
      });
      newPoll = await newPoll.save();
      group.polls.push(newPoll._id);
    }

    // Save final group with tasks and polls
    group = await group.save();

    // Create or sync Stream channel for this group
    try {
      const streamInfo = await getOrCreateGroupChannel(group._id.toString(), group.name, group.members);
      group.streamChannelId = streamInfo.channelId;
      group.streamChannelType = streamInfo.channelType;
      await group.save();
    } catch (streamErr) {
      console.error('Stream channel sync failed:', streamErr.message);
    }

    // Populate the members details before sending response
    group = await group.populate('members', 'username email');

    return res.status(201).json({
      message: 'Group created',
      data: group,
      error: null
    });
  } catch (err) {
    console.error('Group creation error:', err);
    return res.status(500).json({
      message: 'Failed to create group',
      data: null,
      error: err.message || 'Internal server error'
    });
  }
};

const getUserGroups = async (req, res) => {
  try {
    console.log(req.user);
    const allGroups = await Group.find({ members: { $in: req.user.id.toString() } })
      .populate('tasks')
      .populate('polls')
      .populate('members', '_id'); // Only need member IDs for counting

    // Filter out null values from tasks, polls, and members (deleted documents)
    const processedGroups = allGroups.map(group => {
      const groupObj = group.toObject();
      // Filter out null/undefined tasks (deleted tasks that still have IDs in the array)
      groupObj.tasks = (groupObj.tasks || []).filter(task => task !== null && task !== undefined);
      // Filter out null/undefined polls (deleted polls that still have IDs in the array)
      groupObj.polls = (groupObj.polls || []).filter(poll => poll !== null && poll !== undefined);
      // Filter out null/undefined members (deleted users that still have IDs in the array)
      groupObj.members = (groupObj.members || []).filter(member => member !== null && member !== undefined);
      return groupObj;
    });

    const groupsOwned = processedGroups.filter(group => group.owner.toString() === req.user.id.toString());
    const groups = processedGroups.filter(group => group.owner.toString() !== req.user.id.toString());
    return res.status(200).json({ message: 'Groups fetched', data: { groupsOwned, groups }, error: null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to fetch groups', data: null, error: err });
  }
}

const getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id || req.user._id;

    // Validate if groupId is provided
    if (!groupId) {
      return res.status(400).json({
        message: 'Failed to fetch group details',
        data: null,
        error: 'Group ID is required'
      });
    }

    // Check if ID is valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        message: 'Failed to fetch group details',
        data: null,
        error: 'Invalid group ID format'
      });
    }

    const group = await Group.findById(groupId)
      .populate('members', 'username email firstName lastName image hiddenProgress')
      .populate('owners', 'username email firstName lastName image');

    if (!group) {
      return res.status(404).json({
        message: 'Failed to fetch group details',
        data: null,
        error: 'Group not found'
      });
    }

    let today= new Date();
    today =Date.now()-1* 24 * 60 * 60 * 1000;
    console.log(today);
    
    // Fetch tasks with completion details
    let tasks = await Task.find({ 
      group: groupId,
    
    })
    .populate('usersCompleted', '_id username email firstName lastName image')
    .sort({ deadline: 1 });

    tasks = tasks.filter(task => {return (Number(task.deadline) >= today)});
    console.log(tasks);

    let polls = await Poll.find({ group: groupId }).sort({ deadline: 1 });


    polls= polls.filter(poll => {return (Number(poll.deadline) >= today)});
    console.log(polls);

    return res.status(200).json({
      message: 'Group details fetched',
      data: {
        group,
        tasks,
        polls
      },
      error: null
    });
  } catch (err) {
    console.error('Error fetching group details:', err);
    return res.status(500).json({
      message: 'Failed to fetch group details',
      data: null,
      error: err.message
    });
  }
};

const updateGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, image, members, hiddenMembers } = req.body;
    const userId = req.user._id || req.user.id;

    let group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found', data: null, error: 'Group not found' });

    // Allow any owner (super owner or co-owner) to update group details
    if (!isGroupOwner(group, userId)) return res.status(403).json({ message: 'Unauthorized', data: null, error: 'Only group owners can update group details' });

    if (members) {
      group.members = members;
    }

    if (hiddenMembers) {
      group.hiddenMembers = hiddenMembers;
    }

    if (name) {
      group.name = name;
    }

    if (description) {
      group.description = description;
    }

    // Handle image update/deletion
    if (image === null || image === '') {
      // If image is null or empty string, remove the image
      group.image = undefined; // or group.image = null;
    } else if (image) {
      // If new image is provided, update it
      group.image = image;
    }
    // If image is not in the request, keep the existing image

    group = await group.save();

    return res.status(200).json({ message: 'Group details updated', data: group, error: null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to update group details', data: null, error: err });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    let group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found', data: null, error: 'Group not found' });
    if (group.owner.toString() !== req.user.id.toString()) return res.status(403).json({ message: 'Unauthorized', data: null, error: 'Unauthorized' });

    // Delete associated Stream channel if exists
    if (group.streamChannelId) {
      try {
        await deleteGroupChannel(group.streamChannelType, group.streamChannelId);
      } catch (e) {
        console.error('Failed to delete Stream channel', e.message);
      }
    }

    group = await Group.findByIdAndDelete(groupId);
    return res.status(200).json({ message: 'Group deleted', data: group, error: null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to delete group', data: null, error: err });
  }
}

const groupActions = async (req, res) => {
  const { action, groupId, members } = req.body;

  console.log('Received action request:', { action, groupId, members }); // Debug log

  try {
    if (!action) {
      return res.status(400).json({
        message: 'Invalid request',
        data: null,
        error: 'Action is required'
      });
    }

    switch (action) {
      case 'addMembers':
        return addMembersToGroup(req, res);
      case 'removeMembers':
        return removeMembersFromGroup(req, res);
      case 'leaveGroup':
        return leaveGroup(req, res);
      default:
        return res.status(400).json({
          message: 'Invalid action',
          data: null,
          error: `Invalid action type. Allowed actions are: addMembers, removeMembers, leaveGroup. Received: ${action}`
        });
    }
  } catch (err) {
    console.error('Group action error:', err);
    return res.status(500).json({
      message: 'Failed to perform group action',
      data: null,
      error: err.message
    });
  }
};

// Add members to an existing group
const addMembersToGroup = async (req, res) => {
  try {
    const { groupId, members } = req.body;
    const userId = req.user._id || req.user.id;

    let group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: 'Group not found',
        data: null,
        error: 'Group not found'
      });
    }

    // Check if user is an owner (super owner or co-owner)
    if (!isGroupOwner(group, userId)) {
      return res.status(403).json({
        message: 'Unauthorized',
        data: null,
        error: 'Only group owners can add members'
      });
    }

    // Find users by username or email
    const memberUsers = await User.find({
      _id: { $in: members }
    });

    if (memberUsers.length === 0) {
      return res.status(404).json({
        message: 'Failed to add members',
        data: null,
        error: 'No valid users found'
      });
    }

    // Add new members if they're not already in the group
    memberUsers.forEach(user => {
      if (!group.members.includes(user._id)) {
        group.members.push(user._id);
      }
    });

    await group.save();

    // Sync Stream channel members
    try {
      await getOrCreateGroupChannel(group._id.toString(), group.name, group.members);
    } catch (errSync) {
      console.error('Stream sync failed:', errSync.message);
    }

    // Populate member details before sending response
    group = await group.populate('members', 'username email');

    return res.status(200).json({
      message: 'Members added successfully',
      data: group,
      error: null
    });
  } catch (err) {
    console.error('Add members error:', err);
    return res.status(500).json({
      message: 'Failed to add members',
      data: null,
      error: err.message
    });
  }
};

// Helper function to check if user is an owner (super owner or additional owner)
const isGroupOwner = (group, userId) => {
  const userIdStr = userId.toString();
  return group.owner.toString() === userIdStr || 
         (group.owners && group.owners.some(o => o.toString() === userIdStr));
};

// Helper function to check if user is the super owner (original creator)
const isSuperOwner = (group, userId) => {
  return group.owner.toString() === userId.toString();
};

// Add owner to group
const addOwner = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberId } = req.body;
    const userId = req.user._id || req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: 'Group not found',
        error: 'Group not found'
      });
    }

    // Only existing owners can add new owners
    if (!isGroupOwner(group, userId)) {
      return res.status(403).json({
        message: 'Not authorized',
        error: 'Only group owners can add new owners'
      });
    }

    // Check if the member exists in the group
    const memberIdStr = memberId.toString();
    if (!group.members.some(m => m.toString() === memberIdStr)) {
      return res.status(400).json({
        message: 'Failed to add owner',
        error: 'User must be a group member first'
      });
    }

    // Check if already an owner
    if (group.owner.toString() === memberIdStr || 
        (group.owners && group.owners.some(o => o.toString() === memberIdStr))) {
      return res.status(400).json({
        message: 'Failed to add owner',
        error: 'User is already an owner'
      });
    }

    // Initialize owners array if it doesn't exist
    if (!group.owners) {
      group.owners = [];
    }

    group.owners.push(memberId);
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate('members', 'username email firstName lastName image')
      .populate('owners', 'username email firstName lastName image');

    return res.status(200).json({
      message: 'Owner added successfully',
      data: updatedGroup,
      error: null
    });
  } catch (err) {
    console.error('Add owner error:', err);
    return res.status(500).json({
      message: 'Failed to add owner',
      error: err.message
    });
  }
};

// Remove owner from group (demote to regular member)
const removeOwner = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberId } = req.body;
    const userId = req.user._id || req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: 'Group not found',
        error: 'Group not found'
      });
    }

    const memberIdStr = memberId.toString();
    const userIdStr = userId.toString();

    // Cannot remove the super owner (original creator)
    if (group.owner.toString() === memberIdStr) {
      return res.status(403).json({
        message: 'Not authorized',
        error: 'Cannot remove the original group creator from ownership'
      });
    }

    // Only owners can remove other owners
    if (!isGroupOwner(group, userId)) {
      return res.status(403).json({
        message: 'Not authorized',
        error: 'Only group owners can remove owners'
      });
    }

    // Check if target is actually an owner
    if (!group.owners || !group.owners.some(o => o.toString() === memberIdStr)) {
      return res.status(400).json({
        message: 'Failed to remove owner',
        error: 'User is not an owner'
      });
    }

    // Remove from owners array
    group.owners = group.owners.filter(o => o.toString() !== memberIdStr);
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate('members', 'username email firstName lastName image')
      .populate('owners', 'username email firstName lastName image');

    return res.status(200).json({
      message: 'Owner removed successfully',
      data: updatedGroup,
      error: null
    });
  } catch (err) {
    console.error('Remove owner error:', err);
    return res.status(500).json({
      message: 'Failed to remove owner',
      error: err.message
    });
  }
};

// Remove members from a group
const removeMembersFromGroup = async (req, res) => {
  try {
    const { members } = req.body;
    const groupId = req.params.groupId;
    const userId = req.user._id || req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: 'Group not found',
        error: 'Group not found'
      });
    }

    // Allow admin or any group owner to remove members
    if (req.user.role !== 'admin' && !isGroupOwner(group, userId)) {
      return res.status(403).json({
        message: 'Not authorized',
        error: 'Only group owners or admin can remove members'
      });
    }

    // Find users by ID, username, or email
    const memberUsers = await User.find({
      $or: [
        { _id: { $in: members } },           // Check by ID
        { username: { $in: members } },      // Check by username
        { email: { $in: members } }          // Check by email
      ]
    });

    if (memberUsers.length === 0) {
      return res.status(404).json({
        message: 'Failed to remove members',
        data: null,
        error: 'No valid users found'
      });
    }

    const memberIds = memberUsers.map(user => user._id);
    
    // Check if trying to remove the super owner
    if (memberIds.some(id => id.toString() === group.owner.toString())) {
      return res.status(403).json({
        message: 'Failed to remove members',
        error: 'Cannot remove the original group creator'
      });
    }

    // Remove members from members array
    group.members = group.members.filter(memberId =>
      !memberIds.some(id => id.toString() === memberId.toString())
    );

    // Also remove from owners array if they were owners
    if (group.owners) {
      group.owners = group.owners.filter(ownerId =>
        !memberIds.some(id => id.toString() === ownerId.toString())
      );
    }

    await group.save();

    // Sync Stream channel members
    try {
      await getOrCreateGroupChannel(group._id.toString(), group.name, group.members);
    } catch (errSync) {
      console.error('Stream sync failed:', errSync.message);
    }

    // Populate member details before sending response
    const updatedGroup = await Group.findById(groupId)
      .populate('members', 'username email firstName lastName image')
      .populate('owners', 'username email firstName lastName image');

    return res.status(200).json({
      message: 'Members removed successfully',
      data: updatedGroup,
      error: null
    });
  } catch (err) {
    console.error('Remove members error:', err);
    return res.status(500).json({
      message: 'Failed to remove members',
      error: err.message
    });
  }
};

const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.body;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found', data: null, error: 'Group not found' });

    if (!group.members.includes(req.user.id)) return res.status(400).json({ message: 'You are not a member of this group', data: null, error: 'You are not a member of this group' });

    group.members = group.members.filter(id => id.toString() !== req.user.id.toString());
    await group.save();
    return res.status(200).json({ message: 'Left group', data: group, error: null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to leave group', data: null, error: err });
  }
}

const addTask = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;
    const taskData = req.body;

    // Find the group
    const group = await Group.findById(groupId).populate('members', 'username email');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if the user is an owner (super owner or co-owner)
    if (!isGroupOwner(group, userId)) {
      return res.status(403).json({ message: 'Only group owners can add tasks' });
    }

    // Create a new Task document using the Task model
    let newTask = new Task({
      title: taskData.title,
      description: taskData.description,
      deadline: taskData.deadline,
      group: groupId,
      assignedTo: taskData.assignedTo || [],
      createdBy: userId,
      usersCompleted: []
    });

    // Save the task to get an ObjectId
    newTask = await newTask.save();

    // Now push the ObjectId reference to the group's tasks array
    group.tasks.push(newTask._id);
    await group.save();

    // Send email notifications to all group members
    try {
      // Get verified group members
      const groupMembers = group.members.filter(member => member.email);
      
      if (groupMembers.length > 0) {
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

        // Format the task deadline
        const taskDeadline = new Date(taskData.deadline).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        // Create email template
        const emailPromises = groupMembers.map(member => {
          const mailData = {
            from: process.env.SENDER,
            to: member.email,
            subject: `New Task Added: ${taskData.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #2c5530; text-align: center;">📋 New Task Added!</h2>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #2c5530; margin-top: 0;">${taskData.title}</h3>
                  <p style="color: #666; margin: 10px 0;"><strong>👥 Group:</strong> ${group.name}</p>
                  <p style="color: #666; margin: 10px 0;"><strong>📅 Deadline:</strong> ${taskDeadline}</p>
                </div>
                
                <p style="color: #666;">Dear ${member.username},</p>
                <p style="color: #666;">A new task has been added to your Faith Circle "${group.name}". Make sure to complete it before the deadline!</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="http://localhost:3001/groups/${groupId}" style="background-color: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Task Details</a>
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
        console.log(`Email notifications sent to ${groupMembers.length} members for new task: ${taskData.title}`);
      }
    } catch (emailError) {
      // Log email error but don't fail the task creation
      console.error('Error sending email notifications:', emailError);
    }

    // Populate any related fields if needed
    newTask = await newTask.populate('usersCompleted', 'username email firstName lastName image');

    return res.status(201).json(newTask);
  } catch (error) {
    console.error('Add task error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const taskActions = async (req, res) => {
  try {
    const { groupId, taskId } = req.params;
    const userId = req.user.id;

    console.log('userId', userId);
    console.log('groupId', groupId);
    console.log('taskId', taskId);

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: 'Failed to update task',
        data: null,
        error: 'Group not found'
      });
    }

    // Check if user is a member of the group
    // console.log('group.members', group.members);
    if (!group.members.includes(userId)) {
      return res.status(403).json({
        message: 'Failed to update task',
        data: null,
        error: 'Not a member of this group'
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        message: 'Failed to update task',
        data: null,
        error: 'Task not found'
      });
    }

    // Toggle user's completion status
    // if not completed, add to usersCompleted

    // if completed, remove from usersCompleted
    let usersCompleted = task.usersCompleted;
    let wasCompleted = usersCompleted.includes(userId.toString());
    
    if (wasCompleted) {
      usersCompleted = usersCompleted.filter(id => id.toString() !== userId.toString());
    } else {
      usersCompleted.push(userId);
    }

    task.usersCompleted = usersCompleted;

    console.log('task.usersCompleted', task.usersCompleted);

    // Update overall completion status
    task.isCompleted = task.usersCompleted.length === group.members.length;
    await task.save();

    // Record progress history
    try {
      const status = wasCompleted ? 'missed' : 'completed'; // If was completed and toggled off, mark as missed; otherwise completed
      await recordTaskProgressInternal(userId, task, groupId, status);
    } catch (progressErr) {
      console.error('Error recording progress (non-blocking):', progressErr);
    }

    return res.status(200).json({
      message: 'Task completion updated successfully',
      data: task,
      error: null
    });
  } catch (err) {
    console.error('Update task completion error:', err);
    return res.status(500).json({
      message: 'Failed to update task completion',
      data: null,
      error: err.message
    });
  }
};

// Internal function to record task progress (called from taskActions)
const recordTaskProgressInternal = async (userId, task, groupId, status) => {
  try {
    const dateKey = moment().format('YYYY-MM-DD');
    
    // Check if progress already exists for this task and user
    let progress = await TaskProgress.findOne({
      task: task._id,
      user: userId
    });
    
    if (progress) {
      // Update existing progress
      progress.status = status;
      progress.completedAt = status === 'completed' ? new Date() : null;
      progress.dateKey = dateKey;
      await progress.save();
    } else {
      // Create new progress record
      progress = new TaskProgress({
        user: userId,
        task: task._id,
        group: groupId,
        taskTitle: task.title,
        taskDescription: task.description || '',
        status: status,
        completedAt: status === 'completed' ? new Date() : null,
        deadline: task.deadline,
        dateKey: dateKey
      });
      await progress.save();
    }
    
    return progress;
  } catch (err) {
    console.error('Error recording task progress:', err);
    throw err;
  }
};

const deleteTask = async (req, res) => {
  try {
    const { groupId, taskId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: 'Failed to delete task',
        data: null,
        error: 'Group not found'
      });
    }

    // Check if user is an owner (super owner or co-owner)
    const userId = req.user._id || req.user.id;
    if (!isGroupOwner(group, userId)) {
      return res.status(403).json({
        message: 'Failed to delete task',
        data: null,
        error: 'Only group owners can delete tasks'
      });
    }

    // Remove task from group and delete it
    group.tasks = group.tasks.filter(task => task.toString() !== taskId.toString());
    await group.save();
    await Task.findByIdAndDelete(taskId);

    return res.status(200).json({
      message: 'Task deleted successfully',
      data: null,
      error: null
    });
  } catch (err) {
    console.error('Delete task error:', err);
    return res.status(500).json({
      message: 'Failed to delete task',
      data: null,
      error: err.message
    });
  }
};

const addPoll = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id || req.user._id;
    const { title, description, options, deadline } = req.body;

    // Validate required fields
    if (!title || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        message: 'Failed to add poll',
        data: null,
        error: 'Title and at least two options are required'
      });
    }

    // Find the group
    const group = await Group.findById(groupId).populate('members', 'username email');
    if (!group) {
      return res.status(404).json({
        message: 'Failed to add poll',
        data: null,
        error: 'Group not found'
      });
    }

    // Check if user is a member of the group
    const userIdString = userId.toString();
    const isMember = group.members.some(member => 
      member._id ? member._id.toString() === userIdString : member.toString() === userIdString
    );
    
    if (!isMember) {
      return res.status(403).json({
        message: 'Failed to add poll',
        data: null,
        error: 'Not a member of this group'
      });
    }

    // Create poll options
    const pollOptions = options.map(optionText => ({
      text: optionText,
      votes: []
    }));

    // Create the poll
    const newPoll = new Poll({
      title,
      description,
      group: groupId,
      creator: userId,
      options: pollOptions,
      deadline: deadline || null
    });

    // Save the poll
    const savedPoll = await newPoll.save();

    // Add poll to group
    group.polls.push(savedPoll._id);
    await group.save();

    // Send email notifications to all group members
    try {
      // Get verified group members
      const groupMembers = group.members.filter(member => member.email);
      
      if (groupMembers.length > 0) {
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

        // Format the poll deadline if it exists
        const pollDeadline = deadline ? new Date(deadline).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) : 'No deadline';

        // Get poll creator name
        const creator = group.members.find(member => member._id.toString() === userId.toString());
        const creatorName = creator ? creator.username : 'Group Member';

        // Create email template
        const emailPromises = groupMembers.map(member => {
          const mailData = {
            from: process.env.SENDER,
            to: member.email,
            subject: `New Poll Added: ${title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #2c5530; text-align: center;">📊 New Poll Added!</h2>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #2c5530; margin-top: 0;">${title}</h3>
                  <p style="color: #666; margin: 10px 0;"><strong>👥 Group:</strong> ${group.name}</p>
                  <p style="color: #666; margin: 10px 0;"><strong>👤 Created by:</strong> ${creatorName}</p>
                  <p style="color: #666; margin: 10px 0;"><strong>📅 Deadline:</strong> ${pollDeadline}</p>
                  <p style="color: #666; margin: 10px 0;"><strong>🗳️ Options:</strong> ${options.join(', ')}</p>
                </div>
                
                <p style="color: #666;">Dear ${member.username},</p>
                <p style="color: #666;">A new poll has been created in your Faith Circle "${group.name}". Your voice matters - cast your vote now!</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="http://localhost:3001/groups/${groupId}" style="background-color: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Vote Now</a>
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
        console.log(`Email notifications sent to ${groupMembers.length} members for new poll: ${title}`);
      }
    } catch (emailError) {
      // Log email error but don't fail the poll creation
      console.error('Error sending email notifications:', emailError);
    }

    return res.status(201).json({
      message: 'Poll added successfully and notifications sent',
      data: savedPoll,
      error: null
    });
  } catch (err) {
    console.error('Add poll error:', err);
    return res.status(500).json({
      message: 'Failed to add poll',
      data: null,
      error: err.message
    });
  }
};

const deletePoll = async (req, res) => {
  const { groupId, pollId } = req.params;
  const userId = req.user._id || req.user.id;
  
  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found', data: null, error: 'Group not found' });

    // Check if user is an owner (super owner or co-owner)
    if (!isGroupOwner(group, userId)) {
      return res.status(403).json({
        message: 'Failed to delete poll',
        data: null,
        error: 'Only group owners can delete polls'
      });
    }

    let poll = await Poll.findById(pollId);
    if (!poll) return res.status(404).json({ message: 'Poll not found', data: null, error: 'Poll not found' });

    group.polls = group.polls.filter(poll => poll.toString() !== pollId.toString());
    await group.save();

    await poll.deleteOne();

    return res.status(200).json({ message: 'Poll deleted successfully', data: null, error: null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to delete poll', data: null, error: err });
  }
}

const pollActions = async (req, res) => {
  try {
    const { groupId, pollId } = req.params;
    const userId = req.user.id || req.user._id;
    const { optionId } = req.body;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({
        message: 'Failed to vote',
        data: null,
        error: 'Poll not found'
      });
    }

    // Check if user has already voted on this poll
    const hasVoted = poll.options.some(option =>
      option.votes && option.votes.some(vote => vote.toString() === userId.toString())
    );

    if (hasVoted) {
      // Remove user's previous vote from all options
      poll.options.forEach(option => {
        if (option.votes) {
          option.votes = option.votes.filter(vote => vote.toString() !== userId.toString());
        }
      });
    }

    // Add user's vote to the selected option
    const option = poll.options.find(opt => opt._id.toString() === optionId);
    if (!option) {
      return res.status(404).json({
        message: 'Failed to vote',
        data: null,
        error: 'Option not found'
      });
    }

    if (!option.votes) {
      option.votes = [];
    }
    option.votes.push(userId);

    await poll.save();

    return res.status(200).json({
      message: hasVoted ? 'Vote changed successfully' : 'Voted successfully',
      data: poll,
      error: null
    });
  } catch (err) {
    console.error('Error voting on poll:', err);
    return res.status(500).json({
      message: 'Failed to vote',
      data: null,
      error: err.message
    });
  }
};

const toggleProgressVisibility = async (req, res) => {
  // Implementation of toggleProgressVisibility function
};

// Get all groups (Admin only)
const getAllGroups = async (req, res) => {
  try {
    const groups = await Group.find()
      .populate('owner', 'username email')
      .populate('members', 'username email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: 'All groups fetched successfully',
      data: groups,
      error: null
    });
  } catch (err) {
    console.error('Error fetching all groups:', err);
    return res.status(500).json({
      message: 'Failed to fetch groups',
      data: null,
      error: err.message
    });
  }
};

// Update group by admin
const updateGroupByAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const updateData = req.body;

    const group = await Group.findByIdAndUpdate(
      groupId,
      updateData,
      { new: true }
    ).populate('owner members', 'username email');

    if (!group) {
      return res.status(404).json({
        message: 'Group not found',
        data: null,
        error: 'Group not found'
      });
    }

    return res.status(200).json({
      message: 'Group updated successfully',
      data: group,
      error: null
    });
  } catch (err) {
    console.error('Error updating group:', err);
    return res.status(500).json({
      message: 'Failed to update group',
      data: null,
      error: err.message
    });
  }
};

// Delete group by admin
const deleteGroupByAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Delete associated tasks
    await Task.deleteMany({ group: groupId });
    
    // Delete associated polls
    await Poll.deleteMany({ group: groupId });
    
    // Delete the group
    const group = await Group.findByIdAndDelete(groupId);
    
    if (!group) {
      return res.status(404).json({
        message: 'Group not found',
        data: null,
        error: 'Group not found'
      });
    }

    return res.status(200).json({
      message: 'Group and associated data deleted successfully',
      data: null,
      error: null
    });
  } catch (err) {
    console.error('Error deleting group:', err);
    return res.status(500).json({
      message: 'Failed to delete group',
      data: null,
      error: err.message
    });
  }
};

// ============== USER TASK LIST FUNCTIONS ==============

// Get user's personal task list
const getUserTaskList = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    const tasks = await UserTaskList.find({ user: userId })
      .sort({ createdAt: -1 });
    
    return res.status(200).json({
      message: 'User task list fetched successfully',
      data: tasks,
      error: null
    });
  } catch (err) {
    console.error('Error fetching user task list:', err);
    return res.status(500).json({
      message: 'Failed to fetch user task list',
      data: null,
      error: err.message
    });
  }
};

// Add task to user's personal task list
const addToUserTaskList = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { title, description, category, isBuiltIn, builtInTaskId } = req.body;
    
    if (!title) {
      return res.status(400).json({
        message: 'Title is required',
        data: null,
        error: 'Title is required'
      });
    }
    
    // Check if task already exists in user's list
    const existingTask = await UserTaskList.findOne({ 
      user: userId, 
      title: title.trim() 
    });
    
    if (existingTask) {
      return res.status(400).json({
        message: 'Task already exists in your list',
        data: existingTask,
        error: 'Duplicate task'
      });
    }
    
    const newTask = new UserTaskList({
      user: userId,
      title: title.trim(),
      description: description || '',
      category: category || 'Custom',
      isBuiltIn: isBuiltIn || false,
      builtInTaskId: builtInTaskId || null
    });
    
    await newTask.save();
    
    return res.status(201).json({
      message: 'Task added to your list successfully',
      data: newTask,
      error: null
    });
  } catch (err) {
    console.error('Error adding task to user list:', err);
    if (err.code === 11000) {
      return res.status(400).json({
        message: 'Task already exists in your list',
        data: null,
        error: 'Duplicate task'
      });
    }
    return res.status(500).json({
      message: 'Failed to add task to your list',
      data: null,
      error: err.message
    });
  }
};

// Remove task from user's personal task list
const removeFromUserTaskList = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { taskId } = req.params;
    
    const task = await UserTaskList.findOneAndDelete({
      _id: taskId,
      user: userId
    });
    
    if (!task) {
      return res.status(404).json({
        message: 'Task not found in your list',
        data: null,
        error: 'Task not found'
      });
    }
    
    return res.status(200).json({
      message: 'Task removed from your list',
      data: task,
      error: null
    });
  } catch (err) {
    console.error('Error removing task from user list:', err);
    return res.status(500).json({
      message: 'Failed to remove task from your list',
      data: null,
      error: err.message
    });
  }
};

// ============== PROGRESS HISTORY FUNCTIONS ==============

// Record task completion in progress history
const recordTaskProgress = async (userId, task, group, status) => {
  try {
    const dateKey = moment().format('YYYY-MM-DD');
    
    // Check if progress already exists for this task and user
    let progress = await TaskProgress.findOne({
      task: task._id,
      user: userId
    });
    
    if (progress) {
      // Update existing progress
      progress.status = status;
      progress.completedAt = status === 'completed' ? new Date() : null;
      progress.dateKey = dateKey;
      await progress.save();
    } else {
      // Create new progress record
      progress = new TaskProgress({
        user: userId,
        task: task._id,
        group: group,
        taskTitle: task.title,
        taskDescription: task.description || '',
        status: status,
        completedAt: status === 'completed' ? new Date() : null,
        deadline: task.deadline,
        dateKey: dateKey
      });
      await progress.save();
    }
    
    return progress;
  } catch (err) {
    console.error('Error recording task progress:', err);
    throw err;
  }
};

// Get user's progress history
const getUserProgressHistory = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { period, startDate, endDate, groupId } = req.query;
    
    let dateFilter = {};
    let taskDateFilter = {};
    const now = moment();
    
    switch (period) {
      case 'today':
        dateFilter = {
          dateKey: now.format('YYYY-MM-DD')
        };
        taskDateFilter = {
          deadline: {
            $gte: now.clone().startOf('day').toDate(),
            $lte: now.clone().endOf('day').toDate()
          }
        };
        break;
      case 'week':
        dateFilter = {
          createdAt: {
            $gte: now.clone().startOf('week').toDate(),
            $lte: now.clone().endOf('week').toDate()
          }
        };
        taskDateFilter = {
          deadline: {
            $gte: now.clone().startOf('week').toDate(),
            $lte: now.clone().endOf('week').toDate()
          }
        };
        break;
      case 'month':
        dateFilter = {
          createdAt: {
            $gte: now.clone().startOf('month').toDate(),
            $lte: now.clone().endOf('month').toDate()
          }
        };
        taskDateFilter = {
          deadline: {
            $gte: now.clone().startOf('month').toDate(),
            $lte: now.clone().endOf('month').toDate()
          }
        };
        break;
      case 'year':
        dateFilter = {
          createdAt: {
            $gte: now.clone().startOf('year').toDate(),
            $lte: now.clone().endOf('year').toDate()
          }
        };
        taskDateFilter = {
          deadline: {
            $gte: now.clone().startOf('year').toDate(),
            $lte: now.clone().endOf('year').toDate()
          }
        };
        break;
      case 'custom':
        if (startDate && endDate) {
          dateFilter = {
            createdAt: {
              $gte: moment(startDate).startOf('day').toDate(),
              $lte: moment(endDate).endOf('day').toDate()
            }
          };
          taskDateFilter = {
            deadline: {
              $gte: moment(startDate).startOf('day').toDate(),
              $lte: moment(endDate).endOf('day').toDate()
            }
          };
        }
        break;
      default:
        // All time - no date filter
        break;
    }
    
    // Get explicit progress records
    const progressQuery = {
      user: userId,
      ...dateFilter
    };
    
    // Filter by groupId if provided
    if (groupId) {
      progressQuery.group = groupId;
    }
    
    const progressRecords = await TaskProgress.find(progressQuery)
    .populate('group', 'name')
    .sort({ createdAt: -1 });

    // Get groups - either specific group or all user's groups
    let groupIds;
    let userGroups;
    
    if (groupId) {
      // Verify user is member of this group
      const group = await Group.findOne({
        _id: groupId,
        members: userId
      }).select('_id name');
      
      if (!group) {
        return res.status(404).json({
          message: 'Group not found or you are not a member',
          data: null,
          error: 'Group not found'
        });
      }
      
      userGroups = [group];
      groupIds = [group._id];
    } else {
      // Get all groups user is a member of
      userGroups = await Group.find({
        members: userId
      }).select('_id name');
      groupIds = userGroups.map(g => g._id);
    }

    // Get all tasks from user's groups with deadlines that have passed (within the period filter)
    const allTasks = await Task.find({
      group: { $in: groupIds },
      deadline: { $lte: new Date() }, // Only past/expired tasks
      ...taskDateFilter
    }).populate('group', 'name');

    // Create a map of tasks that already have progress records
    const recordedTaskIds = new Set(progressRecords.map(r => r.task?.toString()));

    // Add tasks that don't have explicit progress records (mark as missed if not completed)
    const additionalRecords = [];
    for (const task of allTasks) {
      if (!recordedTaskIds.has(task._id.toString())) {
        // Check if user completed this task
        const userCompleted = task.usersCompleted && task.usersCompleted.some(
          id => id.toString() === userId.toString()
        );
        
        additionalRecords.push({
          _id: `auto-${task._id}`,
          user: userId,
          task: task._id,
          group: task.group,
          taskTitle: task.title,
          taskDescription: task.description || '',
          status: userCompleted ? 'completed' : 'missed',
          completedAt: userCompleted ? task.deadline : null,
          deadline: task.deadline,
          dateKey: moment(task.deadline).format('YYYY-MM-DD'),
          createdAt: task.deadline
        });
      }
    }

    // Combine and sort all records
    const allRecords = [...progressRecords, ...additionalRecords].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    // Calculate statistics
    const completedTasks = allRecords.filter(p => p.status === 'completed');
    const missedTasks = allRecords.filter(p => p.status === 'missed');
    
    const stats = {
      total: allRecords.length,
      completed: completedTasks.length,
      missed: missedTasks.length,
      completionRate: allRecords.length > 0 
        ? Math.round((completedTasks.length / allRecords.length) * 100) 
        : 0
    };
    
    // Group by date for chart data
    const dailyProgress = {};
    allRecords.forEach(record => {
      const date = record.dateKey;
      if (!dailyProgress[date]) {
        dailyProgress[date] = { completed: 0, missed: 0 };
      }
      if (record.status === 'completed') {
        dailyProgress[date].completed++;
      } else {
        dailyProgress[date].missed++;
      }
    });
    
    return res.status(200).json({
      message: 'Progress history fetched successfully',
      data: {
        records: allRecords,
        stats,
        dailyProgress
      },
      error: null
    });
  } catch (err) {
    console.error('Error fetching progress history:', err);
    return res.status(500).json({
      message: 'Failed to fetch progress history',
      data: null,
      error: err.message
    });
  }
};

// Get progress summary for dashboard
const getProgressSummary = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { groupId } = req.query;
    const now = moment();
    
    // Build base query
    const baseQuery = { user: userId };
    if (groupId) {
      baseQuery.group = groupId;
    }
    
    // Today's progress
    const todayProgress = await TaskProgress.find({
      ...baseQuery,
      dateKey: now.format('YYYY-MM-DD')
    });
    
    // This week's progress
    const weekProgress = await TaskProgress.find({
      ...baseQuery,
      createdAt: {
        $gte: now.clone().startOf('week').toDate(),
        $lte: now.clone().endOf('week').toDate()
      }
    });
    
    // This month's progress
    const monthProgress = await TaskProgress.find({
      ...baseQuery,
      createdAt: {
        $gte: now.clone().startOf('month').toDate(),
        $lte: now.clone().endOf('month').toDate()
      }
    });
    
    // This year's progress
    const yearProgress = await TaskProgress.find({
      ...baseQuery,
      createdAt: {
        $gte: now.clone().startOf('year').toDate(),
        $lte: now.clone().endOf('year').toDate()
      }
    });
    
    const calculateStats = (records) => {
      const completed = records.filter(r => r.status === 'completed').length;
      const missed = records.filter(r => r.status === 'missed').length;
      return {
        total: records.length,
        completed,
        missed,
        completionRate: records.length > 0 ? Math.round((completed / records.length) * 100) : 0
      };
    };
    
    return res.status(200).json({
      message: 'Progress summary fetched successfully',
      data: {
        today: calculateStats(todayProgress),
        week: calculateStats(weekProgress),
        month: calculateStats(monthProgress),
        year: calculateStats(yearProgress)
      },
      error: null
    });
  } catch (err) {
    console.error('Error fetching progress summary:', err);
    return res.status(500).json({
      message: 'Failed to fetch progress summary',
      data: null,
      error: err.message
    });
  }
};

module.exports = {
  createGroup,
  getUserGroups,
  getGroupDetails,
  updateGroupDetails,
  deleteGroup,
  groupActions,
  addTask,
  deleteTask,
  taskActions,
  addPoll,
  deletePoll,
  pollActions,
  toggleProgressVisibility,
  getAllGroups,
  updateGroupByAdmin,
  deleteGroupByAdmin,
  // User Task List functions
  getUserTaskList,
  addToUserTaskList,
  removeFromUserTaskList,
  // Progress History functions
  recordTaskProgress,
  getUserProgressHistory,
  getProgressSummary,
  // Ownership management functions
  addOwner,
  removeOwner
};
