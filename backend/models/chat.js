// models/Chat.js - MongoDB Schema for Chat History

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const chatSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  userIP: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  messages: [messageSchema],
  metadata: {
    model: {
      type: String,
      default: 'openai/gpt-4o'
    },
    filtered: {
      type: Boolean,
      default: false
    },
    tokensUsed: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true 
});

chatSchema.index({ createdAt: -1 });
chatSchema.index({ 'messages.timestamp': -1 });

chatSchema.statics.saveInteraction = async function(sessionId, userMessage, aiResponse, metadata = {}) {
  try {
    const chat = await this.findOneAndUpdate(
      { sessionId },
      {
        $push: {
          messages: {
            $each: [
              {
                role: 'user',
                content: userMessage,
                timestamp: new Date()
              },
              {
                role: 'assistant',
                content: aiResponse,
                timestamp: new Date()
              }
            ]
          }
        },
        $set: {
          userIP: metadata.userIP || null,
          userAgent: metadata.userAgent || null,
          'metadata.model': metadata.model || 'openai/gpt-4o',
          'metadata.filtered': metadata.filtered || false,
          'metadata.tokensUsed': metadata.tokensUsed || 0
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );
    return chat;
  } catch (error) {
    console.error('Error saving chat interaction:', error);
    throw error;
  }
};

chatSchema.statics.getHistory = async function(sessionId, limit = 50) {
  try {
    const chat = await this.findOne({ sessionId })
      .select('messages sessionId createdAt updatedAt')
      .lean();
    
    if (!chat) return null;
    
    if (chat.messages && chat.messages.length > limit) {
      chat.messages = chat.messages.slice(-limit);
    }
    
    return chat;
  } catch (error) {
    console.error('Error fetching chat history:', error);
    throw error;
  }
};

chatSchema.statics.getAllChats = async function(page = 1, limit = 20) {
  try {
    const skip = (page - 1) * limit;
    
    const chats = await this.find()
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('sessionId messages metadata createdAt updatedAt userIP')
      .lean();
    
    const total = await this.countDocuments();
    
    return {
      chats,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        hasMore: skip + chats.length < total
      }
    };
  } catch (error) {
    console.error('Error fetching all chats:', error);
    throw error;
  }
};

// Static method to search chats
chatSchema.statics.searchChats = async function(query, page = 1, limit = 20) {
  try {
    const skip = (page - 1) * limit;
    
    const searchRegex = new RegExp(query, 'i');
    
    const chats = await this.find({
      'messages.content': searchRegex
    })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('sessionId messages metadata createdAt updatedAt')
      .lean();
    
    const total = await this.countDocuments({
      'messages.content': searchRegex
    });
    
    return {
      chats,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        hasMore: skip + chats.length < total
      }
    };
  } catch (error) {
    console.error('Error searching chats:', error);
    throw error;
  }
};

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;