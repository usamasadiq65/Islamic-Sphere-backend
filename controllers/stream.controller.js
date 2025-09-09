const StreamChat = require('stream-chat').StreamChat;
const CONFIG = require('../config');

// Initialize Stream Chat server-side client
const serverClient = StreamChat.getInstance(
  CONFIG.STREAM_API_KEY,
  CONFIG.STREAM_API_SECRET
);

// Helper functions for group channel management
const getOrCreateGroupChannel = async (groupId, groupName, memberIds) => {
  const channelId = `group-${groupId}`;
  const allMembers = [...new Set(memberIds.map(id => id.toString()))];

  // Ensure users exist on Stream
  await Promise.all(allMembers.map(async (id) => {
    try {
      await serverClient.upsertUser({ id });
    } catch (err) {
      console.warn('Stream upsertUser failed', id, err.message);
    }
  }));

  const channel = serverClient.channel('messaging', channelId, {
    name: `${groupName} Chat`,
    members: allMembers
  });
  try {
    await channel.create();
  } catch (err) {
    if (err.code === 4) {
      // Existing channel - clear legacy permissions
      try {
        await channel.updatePartial({ unset: ['permissions'] });
      } catch (errUnset) {
        console.warn('Unable to unset permissions on existing channel', errUnset.message);
      }
      await channel.watch();
      const currentMembers = Object.keys(channel.state?.members || {});
      const newMembers = allMembers.filter(m => !currentMembers.includes(m));
      if (newMembers.length) {
        await channel.addMembers(newMembers);
      }
    } else {
      throw err;
    }
  }
  return { channelId, channelType: 'messaging', members: allMembers };
};

const deleteGroupChannel = async (channelType = 'messaging', channelId) => {
  if (!channelId) return;
  const channel = serverClient.channel(channelType, channelId);
  try {
    await channel.delete();
  } catch (err) {
    if (err.code !== 16) {
      console.warn('Failed to delete Stream channel', channelId, err.message);
    }
  }
};

/**
 * Generate GetStream token for user
 * POST /api/stream/token
 */
const generateStreamToken = async (req, res) => {
  try {
    // Validate environment variables
    if (!CONFIG.STREAM_API_KEY || !CONFIG.STREAM_API_SECRET) {
      console.error('Stream API keys not configured:', {
        apiKey: !!CONFIG.STREAM_API_KEY,
        apiSecret: !!CONFIG.STREAM_API_SECRET
      });
      return res.status(500).json({
        success: false,
        message: 'Stream API keys not configured'
      });
    }

    // Validate user data
    if (!req.user || !req.user.id) {
      console.error('User not authenticated or missing ID:', req.user);
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user.id.toString(); // Ensure string format
    const userName = req.user.name || req.user.email || 'Unknown User';

    console.log('Generating Stream token for user:', { userId, userName });

    // Generate token for the user
    const token = serverClient.createToken(userId);

    // Update or create user in Stream
    await serverClient.upsertUser({
      id: userId,
      name: userName,
      image: req.user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0891b2&color=fff`
    });

    console.log('Stream token generated successfully for user:', userId);

    res.json({
      success: true,
      data: {
        token,
        userId,
        userName,
        apiKey: CONFIG.STREAM_API_KEY
      }
    });

  } catch (error) {
    console.error('Stream token generation error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    });
    res.status(500).json({
      success: false,
      message: 'Failed to generate stream token',
      error: error.message
    });
  }
};

/**
 * Create or get group channel
 * POST /api/stream/channel
 */
const createGroupChannel = async (req, res) => {
  try {
    const { groupId, groupName, memberIds } = req.body;
    const userId = req.user.id;

    // Ensure current user is included in members
    const allMembers = [...new Set([userId, ...memberIds])];

    // Ensure all members exist in Stream with proper user data
    const memberPromises = allMembers.map(async (memberId) => {
      try {
        await serverClient.upsertUser({ 
          id: memberId,
          role: 'user'
        });
      } catch (err) {
        console.warn(`Failed to upsert user ${memberId}:`, err);
      }
    });
    await Promise.all(memberPromises);

    const channelId = `group-${groupId}`;
    
    // Create or get channel with proper permissions
    const channel = serverClient.channel('messaging', channelId, {
      name: `${groupName} Chat`,
      created_by_id: userId,
      members: allMembers
    });

    // Let Stream handle channel creation and member permissions by default.
    // If the channel exists, watch() syncs state and addMembers() adds new users.
    try {
      await channel.create();
    } catch (err) {
      if (err.code === 4) { // Channel already exists
        await channel.watch(); // Sync with the existing channel state
        const currentMembers = Object.keys(channel.state.members || {});
        const newMembers = allMembers.filter(m => !currentMembers.includes(m));
        if (newMembers.length) {
          await channel.addMembers(newMembers);
        }
      } else {
        throw err; // Rethrow other errors
      }
    }

    res.json({
      success: true,
      data: {
        channelId: channelId,
        channelType: 'messaging',
        members: allMembers,
        groupId: groupId
      }
    });

  } catch (error) {
    console.error('Channel creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create or get channel',
      error: error.message
    });
  }
};

module.exports = {
  generateStreamToken,
  createGroupChannel,
  getOrCreateGroupChannel,
  deleteGroupChannel
};
