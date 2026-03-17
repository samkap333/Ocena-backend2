// config/aiConfig.js - AI Model Configuration

const AI_CONFIG = {
  provider: 'OpenRouter',
  model: 'openai/gpt-4o',
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  
  // Model parameters
  parameters: {
    temperature: 0.2,
    max_tokens: 350,
    top_p: 0.9
  },
  
  // System prompt template
  systemPromptTemplate: (relevantContext) => `You are Ocena's professional AI assistant. Provide clear, scannable responses with brief descriptions.

RESPONSE FORMAT:
- Use **bold headings** for main topics
- Use bullet points (•) for lists
- Add SHORT descriptions (5-10 words) after each point
- Keep total response under 120 words unless listing 5+ items
- Answer specifically what user asked, but include brief context
- ALWAYS include relevant links as plain URLs (they will be auto-formatted)

GUIDELINES:
1. Answer what user asks with helpful context
2. Use knowledge base: ${relevantContext}
3. For meeting: https://calendar.app.google/pw23w5zRT3ar3JKbA
4. For project form: https://forms.gle/y61TegNfj2Tk3LyD9
5. Contact: business@ocena.in | +91-7652992906
6. Professional yet approachable tone

FORMAT EXAMPLES:
❌ "Web Development - $5000" (too brief)
✅ "Web Development - High-performance websites and mobile apps | Starting $5,000"

❌ "Frontend Course teaches React, Next.js, Vue and you'll learn advanced CSS/SCSS/Tailwind techniques and build 5 portfolio-ready projects..." (too long)
✅ "Frontend Development - Build modern UIs with React, Next.js | $499 | 3 Months"

Balance: Brief description + key info. Professional and scannable.`
};

// Helper function to format links in AI response
function formatLinksInResponse(text) {
  // Pattern to match URLs (http/https)
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  
  // Replace URLs with markdown link format [text](url)
  let formattedText = text.replace(urlPattern, (url) => {
    // Clean up URL (remove trailing punctuation)
    let cleanUrl = url.replace(/[.,;!?)]+$/, '');
    
    // Create friendly link text based on URL
    let linkText;
    if (cleanUrl.includes('calendar.app.google')) {
      linkText = '📅 Schedule Meeting';
    } else if (cleanUrl.includes('forms.gle')) {
      linkText = '📋 Submit Project Details';
    } else if (cleanUrl.includes('ocena.in/about')) {
      linkText = 'About Us';
    } else if (cleanUrl.includes('ocena.in/services')) {
      linkText = 'Our Services';
    } else if (cleanUrl.includes('ocena.in/portfolio')) {
      linkText = 'View Portfolio';
    } else if (cleanUrl.includes('ocena.in/courses')) {
      linkText = 'Browse Courses';
    } else if (cleanUrl.includes('ocena.in/contact')) {
      linkText = 'Contact Page';
    } else {
      linkText = 'Click Here';
    }
    
    return `[${linkText}](${cleanUrl})`;
  });
  
  // Also format email addresses
  formattedText = formattedText.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '[$1](mailto:$1)'
  );
  
  // Format phone numbers (WhatsApp)
  formattedText = formattedText.replace(
    /(\+91-\d{10})/g,
    '[$1](https://wa.me/917652992906)'
  );
  
  return formattedText;
}

// Function to call OpenRouter API
async function callAI(messages, apiKey, appUrl = 'http://localhost:3000') {
  try {
    const response = await fetch(AI_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': appUrl,
        'X-Title': 'Ocena AI Chat'
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: messages,
        ...AI_CONFIG.parameters
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle specific error codes
      if (response.status === 401) {
        throw new Error('INVALID_API_KEY');
      } else if (response.status === 429) {
        throw new Error('RATE_LIMIT');
      } else if (response.status === 402) {
        throw new Error('INSUFFICIENT_CREDITS');
      } else {
        throw new Error('AI_SERVICE_ERROR');
      }
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('NO_RESPONSE');
    }

    const aiResponse = data.choices[0].message?.content || '';
    
    return {
      success: true,
      message: aiResponse.trim(),
      model: data.model || AI_CONFIG.model,
      tokensUsed: data.usage?.total_tokens || 0
    };

  } catch (error) {
    console.error('AI API Error:', error);
    
    // Return error with specific type
    return {
      success: false,
      error: error.message,
      message: null
    };
  }
}

module.exports = {
  AI_CONFIG,
  formatLinksInResponse,
  callAI
};