const CONFIG = require('../config');
const User = require('../models/user.model');
const Group = require('../models/group.model');
const Task = require('../models/task.model');
const Poll = require('../models/poll.model');
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
    const allGroups = await Group.find({ members: { $in: req.user.id.toString() } }).populate('tasks').populate('polls');
    // console.log(groups);
    const groupsOwned = allGroups.filter(group => group.owner.toString() === req.user.id.toString());
    const groups = allGroups.filter(group => group.owner.toString() !== req.user.id.toString());
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
      .populate('members', 'username email firstName lastName image hiddenProgress');

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

    let group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found', data: null, error: 'Group not found' });

    if (group.owner.toString() !== req.user.id.toString()) return res.status(403).json({ message: 'Unauthorized', data: null, error: 'Unauthorized' });

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

    let group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: 'Group not found',
        data: null,
        error: 'Group not found'
      });
    }

    // Check if user is the owner
    if (group.owner.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        message: 'Unauthorized',
        data: null,
        error: 'Only group owner can add members'
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

// Remove members from a group
const removeMembersFromGroup = async (req, res) => {
  try {
    const { members } = req.body;
    const groupId = req.params.groupId;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: 'Group not found',
        error: 'Group not found'
      });
    }

    // Allow both admin and group owner to remove members
    if (req.user.role !== 'admin' && group.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        message: 'Not authorized',
        error: 'Only group owner or admin can remove members'
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

    // Remove members
    const memberIds = memberUsers.map(user => user._id);
    group.members = group.members.filter(memberId =>
      !memberIds.some(id => id.toString() === memberId.toString())
    );

    await group.save();

    // Sync Stream channel members
    try {
      await getOrCreateGroupChannel(group._id.toString(), group.name, group.members);
    } catch (errSync) {
      console.error('Stream sync failed:', errSync.message);
    }

    // Populate member details before sending response
    const updatedGroup = await group.populate('members', 'username email');

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

    // Check if the user is the owner of the group
    if (group.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the group owner can add tasks' });
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
    if (usersCompleted.includes(userId.toString())) {
      usersCompleted = usersCompleted.filter(id => id.toString() !== userId.toString());
    } else {
      usersCompleted.push(userId);
    }

    task.usersCompleted = usersCompleted;

    console.log('task.usersCompleted', task.usersCompleted);

    // Update overall completion status
    task.isCompleted = task.usersCompleted.length === group.members.length;
    await task.save();

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

    // Check if user is the group owner
    if (group.owner.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        message: 'Failed to delete task',
        data: null,
        error: 'Only group owner can delete tasks'
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
  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found', data: null, error: 'Group not found' });

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
  deleteGroupByAdmin
};
