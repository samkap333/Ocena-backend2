// routes/chatRoute.js - AI Chat with MongoDB Integration

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Import configurations and models
const Chat = require('../models/chat');
const { COMPANY_KNOWLEDGE, getRelevantContext, isRelevantQuery } = require('../config/knowledgeBase');
const { AI_CONFIG, formatLinksInResponse, callAI } = require('../config/aiConfig');

// =============================================
// UTILITY FUNCTIONS
// =============================================

// Generate or retrieve session ID
function getSessionId(req) {
  // Check if session ID exists in headers or generate new one
  return req.headers['x-session-id'] || req.body.sessionId || uuidv4();
}

// Extract user metadata
function getUserMetadata(req) {
  return {
    userIP: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'] || 'Unknown'
  };
}

// =============================================
// ROUTES
// =============================================

// Health check endpoint
router.get('/api/chat/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Ocena AI Chat service is running',
    provider: AI_CONFIG.provider,
    model: AI_CONFIG.model,
    mode: 'Domain-Specific RAG with MongoDB',
    timestamp: new Date().toISOString()
  });
});

// Main chat endpoint
router.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    // Validation
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid request. Messages array is required.' 
      });
    }

    if (messages.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Messages array cannot be empty.' 
      });
    }

    // Get session ID and user metadata
    const sessionId = getSessionId(req);
    const userMetadata = getUserMetadata(req);

    // Extract user query
    const lastUserMessage = messages[messages.length - 1];
    const userQuery = lastUserMessage.content || '';

    // Check for greetings
    const isGreeting = /^(hi|hello|hey|good morning|good afternoon|good evening|greetings)$/i.test(userQuery.trim());
    
    // Check relevance (but allow greetings)
    if (!isRelevantQuery(userQuery) && !isGreeting) {
      const fallbackMessage = "I'm here to help with questions about Ocena's services, projects, courses, and more. What would you like to know?";
      
      // Save filtered interaction
      await Chat.saveInteraction(
        sessionId,
        userQuery,
        fallbackMessage,
        {
          ...userMetadata,
          model: AI_CONFIG.model,
          filtered: true,
          tokensUsed: 0
        }
      ).catch(err => console.error('Failed to save filtered chat:', err));

      return res.json({
        success: true,
        message: fallbackMessage,
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        filtered: true
      });
    }

    // Get API key
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

    if (!OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not found');
      return res.status(500).json({ 
        success: false,
        error: 'Server configuration error. Please contact support.' 
      });
    }

    // Get relevant context from knowledge base
    const relevantContext = getRelevantContext(userQuery, COMPANY_KNOWLEDGE);

    // Build system prompt
    const systemPrompt = AI_CONFIG.systemPromptTemplate(relevantContext);

    // Format messages for AI
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Call AI service
    const aiResult = await callAI(
      formattedMessages, 
      OPENROUTER_API_KEY,
      process.env.APP_URL || 'http://localhost:3000'
    );

    // Handle AI errors
    if (!aiResult.success) {
      const errorResponses = {
        'INVALID_API_KEY': { status: 500, message: 'Invalid API configuration.' },
        'RATE_LIMIT': { status: 429, message: 'Too many requests. Please wait a moment.' },
        'INSUFFICIENT_CREDITS': { status: 500, message: 'Service temporarily unavailable.' },
        'NO_RESPONSE': { status: 500, message: 'Failed to generate response.' },
        'AI_SERVICE_ERROR': { status: 500, message: 'AI service temporarily unavailable.' }
      };

      const errorResponse = errorResponses[aiResult.error] || errorResponses['AI_SERVICE_ERROR'];

      return res.status(errorResponse.status).json({ 
        success: false,
        error: errorResponse.message 
      });
    }

    // Format links in AI response
    let aiResponse = formatLinksInResponse(aiResult.message);

    // Save chat interaction to MongoDB
    try {
      await Chat.saveInteraction(
        sessionId,
        userQuery,
        aiResponse,
        {
          ...userMetadata,
          model: aiResult.model,
          filtered: false,
          tokensUsed: aiResult.tokensUsed
        }
      );
    } catch (dbError) {
      console.error('Failed to save chat to MongoDB:', dbError);
      // Don't fail the request if DB save fails
    }

    // Send response
    res.json({ 
      success: true,
      message: aiResponse,
      sessionId: sessionId,
      model: aiResult.model,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat Route Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'An unexpected error occurred.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get chat history for a session
router.get('/api/chat/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const chatHistory = await Chat.getHistory(sessionId, limit);

    if (!chatHistory) {
      return res.status(404).json({
        success: false,
        error: 'No chat history found for this session.'
      });
    }

    res.json({
      success: true,
      data: chatHistory
    });

  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat history.'
    });
  }
});

// Admin: Get all chats (paginated)
router.get('/api/chat/admin/all', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await Chat.getAllChats(page, limit);

    res.json({
      success: true,
      data: result.chats,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Error fetching all chats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chats.'
    });
  }
});

// Admin: Search chats
router.get('/api/chat/admin/search', async (req, res) => {
  try {
    const query = req.query.q;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required.'
      });
    }

    const result = await Chat.searchChats(query, page, limit);

    res.json({
      success: true,
      data: result.chats,
      pagination: result.pagination,
      query: query
    });

  } catch (error) {
    console.error('Error searching chats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search chats.'
    });
  }
});

// Admin: Get chat statistics
router.get('/api/chat/admin/stats', async (req, res) => {
  try {
    const totalChats = await Chat.countDocuments();
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentChats = await Chat.countDocuments({
      createdAt: { $gte: last24Hours }
    });

    // Get most active sessions
    const activeSessions = await Chat.aggregate([
      {
        $project: {
          sessionId: 1,
          messageCount: { $size: '$messages' },
          lastActivity: '$updatedAt'
        }
      },
      { $sort: { messageCount: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      stats: {
        totalChats,
        recentChats,
        activeSessions
      }
    });

  } catch (error) {
    console.error('Error fetching chat stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics.'
    });
  }
});

module.exports = router;