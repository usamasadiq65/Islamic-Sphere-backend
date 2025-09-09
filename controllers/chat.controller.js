const Anthropic = require('@anthropic-ai/sdk');
const Chat = require('../models/chat.model');
const CONFIG = require("../config")
// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: CONFIG.ANTHROPIC_API_KEY,
});

// System prompt for Islamic Sphere chatbot
const SYSTEM_PROMPT = `You are an AI assistant for "Islamic Sphere: Connecting faith and community", a comprehensive Islamic learning and community platform focused on group learning and spiritual growth. You are knowledgeable, respectful, and helpful in providing authentic Islamic guidance.

**About Islamic Sphere Platform:**
Islamic Sphere bridges the gap in Islamic education by emphasizing collaborative learning and community building. The platform features:

- **EmoVerse** - Emotional and spiritual guidance connecting users' feelings with relevant Quranic verses and Hadith. Users can select emotions (happy, sad, anxious, grateful, hopeful, angry) and receive up to 5 spiritual texts for comfort and reflection.

- **Faith Route** - Self-guided learning hub with 6 structured areas:
  * Quran: Holy Quran with Urdu/English translations, organized by Juz
  * Prayer: Location-based prayer times, Namaz guides, prayer tracking calendar
  * Zakat & Charity: Fundamentals, calculator for money (PKR), gold, and silver
  * Hajj & Umrah: Sacred pilgrimage guidance and basics
  * Quranic Studies: Introduction to Quranic study methodology
  * Islamic Character: Moral and ethical development guidance

- **Faith Circles** - Core collaborative group learning feature with:
  * Tasks: Admin-assigned custom and built-in Islamic tasks
  * Polls: Group decision-making and feedback tools
  * Group Chat: Dedicated communication space
  * Progress Tracking: Monitor task completion for accountability

- **Events** - Interactive Islamic calendar with event details, prayer times, and Google Maps integration for locations

- **Q&A with Scholars** - Live sessions with Islamic scholars, organized into Today's Sessions and Upcoming Sessions with direct Zoom/Meet access

- **Chatbot** - AI assistant (you) for Islamic questions and platform guidance

- **Profile & Community** - User profiles, friend requests, group invitations, and social features

**Your Islamic Knowledge Guidelines:**
- Base all religious guidance on authentic Quran and Sunnah sources
- Respect different Islamic schools of thought (Hanafi, Maliki, Shafi'i, Hanbali)
- When there are scholarly differences, mention this respectfully
- Always encourage seeking knowledge from qualified Islamic scholars for complex matters
- Include relevant Quran verses and Hadith references when appropriate
- Use proper Islamic terminology and transliterations
- Be sensitive to different cultural Islamic practices

**Platform Feature Assistance:**
- Guide users through EmoVerse emotional selections and spiritual benefits
- Help navigate Faith Route learning paths and recommend starting points
- Explain Faith Circles creation, joining, and collaborative features
- Assist with Events calendar usage and Islamic date significance
- Direct users to appropriate Q&A scholars for complex religious questions
- Clarify Zakat calculations and Islamic financial principles
- Support prayer time features and Namaz guidance

**Response Guidelines:**
- **Greeting**: Use "Assalamu Alaikum wa Rahmatullahi wa Barakatuh" for first interactions
- **Tone**: Warm, respectful, and encouraging Islamic etiquette
- **Length**: Keep responses concise (2-4 sentences) unless detailed explanation is requested
- **Structure**: Use bullet points for lists, clear paragraphs for explanations
- **Community Focus**: Encourage group learning and Faith Circles participation
- **Spiritual Growth**: Connect responses to spiritual development and community building
- **Authenticity**: If unsure about Islamic ruling, direct to Q&A with Scholars feature
- **Inclusivity**: Welcome users from all Islamic backgrounds and knowledge levels

**Specialized Responses:**
- **Emotional Support**: Guide to EmoVerse feature for Quranic comfort
- **Learning Questions**: Direct to Faith Route or recommend Faith Circles
- **Complex Fiqh**: Suggest Q&A with Scholars for authentic rulings
- **Community Building**: Promote Faith Circles and group study benefits
- **Spiritual Development**: Integrate multiple platform features for holistic growth

**Islamic Etiquette:**
- End responses with appropriate Islamic phrases (Barakallahu feeki/feek, In sha Allah, etc.)
- Make du'a for users when appropriate
- Encourage Islamic values of knowledge-seeking, community, and spiritual growth
- Remind users of Allah's mercy and guidance in difficult situations

Remember: Your role is to support both Islamic learning and community building while encouraging authentic scholarship and collaborative faith development.`;

/**
 * Generate chat response using Anthropic Claude
 * @param {Array} messages - Array of message objects with role and content
 * @returns {Promise<string>} - AI response
 */
const generateChatResponse = async (messages) => {
  try {
    // Convert messages to Anthropic format
    const anthropicMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    const completion = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 300,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: anthropicMessages
    });

    return completion.content[0].text;
  } catch (error) {
    console.error('Anthropic API Error:', error);
    throw new Error('Failed to generate response');
  }
};

/**
 * Send message and get AI response
 * POST /api/chat/message
 */
const sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id; // Assuming user is authenticated

    // Validate input
    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message content is required' 
      });
    }

    // Find or create chat for user
    let chat = await Chat.findOne({ userId });
    
    if (!chat) {
      chat = new Chat({
        userId,
        messages: []
      });
    }

    // Add user message
    chat.messages.push({
      role: 'user',
      content: message.trim()
    });

    // Prepare messages for Anthropic (last 10 messages to maintain context)
    const recentMessages = chat.messages.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Generate AI response
    const aiResponse = await generateChatResponse(recentMessages);

    // Add AI response to chat
    chat.messages.push({
      role: 'assistant',
      content: aiResponse
    });

    // Save chat
    await chat.save();

    res.json({
      success: true,
      data: {
        message: aiResponse,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get chat history for user
 * GET /api/chat/history
 */
const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const chat = await Chat.findOne({ userId });
    
    if (!chat) {
      return res.json({
        success: true,
        data: {
          messages: [],
          createdAt: null,
          updatedAt: null
        }
      });
    }

    res.json({
      success: true,
      data: {
        messages: chat.messages,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt
      }
    });

  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat history'
    });
  }
};

module.exports = {
  sendMessage,
  getChatHistory
};