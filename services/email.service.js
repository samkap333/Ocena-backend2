/**
 * Email Service using Brevo (formerly Sendinblue)
 * 
 * Brevo offers 300 free emails per day
 * Get API key from: https://app.brevo.com/settings/keys/api
 */

const { BrevoClient } = require('@getbrevo/brevo');

// Initialize Brevo API client
let brevoClient = null;

function initializeBrevo() {
  if (!brevoClient && process.env.BREVO_API_KEY) {
    brevoClient = new BrevoClient({
      apiKey: process.env.BREVO_API_KEY,
      timeout: 30000,
      maxRetries: 2
    });
  }
  return brevoClient;
}

/**
 * Send a single email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 * @param {string} options.from - Sender email (optional)
 */
exports.sendEmail = async ({ to, subject, html, text, from }) => {
  try {
    const client = initializeBrevo();
    
    if (!client) {
      console.error('⚠️  Brevo API not configured. Set BREVO_API_KEY in .env');
      throw new Error('Email service not configured');
    }

    const result = await client.transactionalEmails.sendTransacEmail({
      subject,
      htmlContent: html,
      textContent: text || html.replace(/<[^>]*>/g, ''),
      sender: {
        name: process.env.EMAIL_FROM_NAME || 'Ocena CRM',
        email: from || process.env.EMAIL_FROM_EMAIL || 'noreply@ocena.com',
      },
      to: [{ email: to }],
    });
    
    console.log(`✅ Email sent to ${to}: ${result.messageId}`);
    
    return {
      messageId: result.messageId,
      accepted: [to],
      rejected: [],
    };
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    throw new Error(error.message || 'Failed to send email');
  }
};

/**
 * Send bulk emails
 * @param {Array} emails - Array of email objects [{to, subject, html}]
 */
exports.sendBulkEmails = async (emails) => {
  const results = [];

  for (const email of emails) {
    try {
      const result = await exports.sendEmail(email);
      results.push({ ...email, status: 'sent', result });
    } catch (error) {
      results.push({ ...email, status: 'failed', error: error.message });
    }
  }

  return results;
};

/**
 * Send template email
 * @param {Object} options - Template options
 * @param {string} options.to - Recipient email
 * @param {string} options.template - Template name
 * @param {Object} options.data - Template data
 * @param {string} options.subject - Email subject (optional)
 */
exports.sendTemplateEmail = async ({ to, template, data, subject }) => {
  const templates = {
    welcome: {
      subject: 'Welcome to Ocena CRM',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3b82f6;">Welcome ${data.name}!</h1>
          <p>Thank you for joining Ocena CRM.</p>
          <p>Get started by logging in to your account and exploring all the features.</p>
          <a href="${data.loginUrl || '#'}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
            Login to Your Account
          </a>
        </div>
      `,
    },
    invoice: {
      subject: `Invoice ${data.invoiceNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3b82f6;">Invoice ${data.invoiceNumber}</h1>
          <p>Dear ${data.customerName},</p>
          <p>Please find your invoice details below:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount Due:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${data.amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Due Date:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${data.dueDate}</td>
            </tr>
          </table>
          <p>Thank you for your business!</p>
        </div>
      `,
    },
    leadAssignment: {
      subject: 'New Lead Assigned',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3b82f6;">New Lead Assigned</h1>
          <p>Hi ${data.assigneeName},</p>
          <p>A new lead has been assigned to you:</p>
          <ul style="list-style: none; padding: 0;">
            <li style="padding: 8px 0;"><strong>Name:</strong> ${data.leadName}</li>
            <li style="padding: 8px 0;"><strong>Company:</strong> ${data.company}</li>
            <li style="padding: 8px 0;"><strong>Email:</strong> ${data.email}</li>
          </ul>
          <a href="${data.leadUrl || '#'}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
            View Lead Details
          </a>
        </div>
      `,
    },
  };

  const templateData = templates[template];
  if (!templateData) {
    throw new Error(`Template "${template}" not found`);
  }

  return exports.sendEmail({
    to,
    subject: subject || templateData.subject,
    html: templateData.html,
  });
};

/**
 * Send email using Brevo template ID
 * @param {Object} options - Template options
 * @param {string} options.to - Recipient email
 * @param {number} options.templateId - Brevo template ID
 * @param {Object} options.params - Template parameters
 */
exports.sendBrevoTemplate = async ({ to, templateId, params }) => {
  try {
    const client = initializeBrevo();
    
    if (!client) {
      console.error('⚠️  Brevo API not configured. Set BREVO_API_KEY in .env');
      throw new Error('Email service not configured');
    }

    const result = await client.transactionalEmails.sendTransacEmail({
      templateId,
      params,
      sender: {
        name: process.env.EMAIL_FROM_NAME || 'Ocena CRM',
        email: process.env.EMAIL_FROM_EMAIL || 'noreply@ocena.com',
      },
      to: [{ email: to }],
    });
    
    console.log(`✅ Template email sent to ${to}: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error('❌ Failed to send template email:', error.message);
    throw error;
  }
};

/**
 * Verify Brevo API configuration
 */
exports.verifyConnection = async () => {
  try {
    const client = initializeBrevo();
    
    if (!client) {
      return {
        success: false,
        message: 'BREVO_API_KEY not set in environment variables',
      };
    }

    // Try to get account info to verify API key
    const account = await client.account.getAccount();
    
    return {
      success: true,
      message: 'Brevo email service configured successfully',
      provider: 'Brevo',
      email: account.email,
      plan: account.plan?.type || 'free',
      dailyLimit: '300 emails/day (free tier)',
    };
  } catch (error) {
    return {
      success: false,
      message: `Brevo configuration error: ${error.message}`,
    };
  }
};
