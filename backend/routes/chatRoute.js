// routes/chatRoute.js - AI Chat Route with OpenRouter

const express = require('express');
const router = express.Router();

// Health check endpoint for chat service
router.get('/api/chat/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Chat service is running',
    provider: 'OpenRouter',
    model: 'openai/gpt-4o',
    timestamp: new Date().toISOString()
  });
});

// Chat endpoint with OpenRouter API
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

    // Get API key from environment variables
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

    if (!OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not found in environment variables');
      return res.status(500).json({ 
        success: false,
        error: 'Server configuration error. Please contact support.' 
      });
    }

    // Prepare messages for OpenRouter (add system message)
    const formattedMessages = [
      {
        role: 'system',
        content: 'You are a professional AI assistant for Ocena, a web development and IT training company. Provide helpful, accurate, and friendly responses about web development, blockchain, courses, and technology services. Keep responses concise and professional.'
      },
      ...messages
    ];

    // Call OpenRouter API
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'Ocena AI Chat'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o',
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 512,
          top_p: 0.95
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });

      if (response.status === 401) {
        return res.status(500).json({ 
          success: false,
          error: 'Invalid API configuration. Please contact support.' 
        });
      } else if (response.status === 429) {
        return res.status(429).json({ 
          success: false,
          error: 'Too many requests. Please wait a moment and try again.' 
        });
      } else if (response.status === 402) {
        return res.status(500).json({ 
          success: false,
          error: 'Service temporarily unavailable. Please try again.' 
        });
      } else {
        return res.status(500).json({ 
          success: false,
          error: 'AI service temporarily unavailable. Please try again.' 
        });
      }
    }

    const data = await response.json();
    
    // OpenRouter follows OpenAI's response format
    let aiResponse = '';
    
    if (data.choices && data.choices.length > 0) {
      aiResponse = data.choices[0].message?.content || '';
    }

    // Clean up the response
    aiResponse = aiResponse.trim();

    if (!aiResponse) {
      return res.status(500).json({ 
        success: false,
        error: 'Failed to generate response. Please try again.' 
      });
    }

    // Send successful response
    res.json({ 
      success: true,
      message: aiResponse,
      model: data.model || 'openai/gpt-4o',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat Route Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
      details: process.env.NODE_ENV === 'production' ? error.message : undefined
    });
  }
});

module.exports = router;