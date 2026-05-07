const twilio = require('twilio');

// Initialize Twilio client
const getClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }

  return twilio(accountSid, authToken);
};

/**
 * Send SMS
 */
exports.sendSMS = async ({ to, message, from }) => {
  try {
    const client = getClient();
    const fromNumber = from || process.env.TWILIO_PHONE_NUMBER;

    if (!fromNumber) {
      throw new Error('Twilio phone number not configured');
    }

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to,
    });

    return {
      sid: result.sid,
      status: result.status,
      to: result.to,
      from: result.from,
    };
  } catch (error) {
    console.error('SMS sending error:', error);
    throw new Error(error.message || 'Failed to send SMS');
  }
};

/**
 * Send bulk SMS
 */
exports.sendBulkSMS = async (messages) => {
  const results = [];

  for (const msg of messages) {
    try {
      const result = await exports.sendSMS(msg);
      results.push({ ...msg, status: 'sent', result });
    } catch (error) {
      results.push({ ...msg, status: 'failed', error: error.message });
    }
  }

  return results;
};

/**
 * Send WhatsApp message
 */
exports.sendWhatsApp = async ({ to, message }) => {
  try {
    const client = getClient();
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!fromNumber) {
      throw new Error('Twilio WhatsApp number not configured');
    }

    // Ensure numbers are in WhatsApp format
    const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const whatsappFrom = fromNumber.startsWith('whatsapp:')
      ? fromNumber
      : `whatsapp:${fromNumber}`;

    const result = await client.messages.create({
      body: message,
      from: whatsappFrom,
      to: whatsappTo,
    });

    return {
      sid: result.sid,
      status: result.status,
      to: result.to,
      from: result.from,
    };
  } catch (error) {
    console.error('WhatsApp sending error:', error);
    throw new Error(error.message || 'Failed to send WhatsApp message');
  }
};

/**
 * Send bulk WhatsApp messages
 */
exports.sendBulkWhatsApp = async (messages) => {
  const results = [];

  for (const msg of messages) {
    try {
      const result = await exports.sendWhatsApp(msg);
      results.push({ ...msg, status: 'sent', result });
    } catch (error) {
      results.push({ ...msg, status: 'failed', error: error.message });
    }
  }

  return results;
};

/**
 * Get message status
 */
exports.getMessageStatus = async (messageSid) => {
  try {
    const client = getClient();
    const message = await client.messages(messageSid).fetch();

    return {
      sid: message.sid,
      status: message.status,
      to: message.to,
      from: message.from,
      dateCreated: message.dateCreated,
      dateSent: message.dateSent,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
    };
  } catch (error) {
    console.error('Get message status error:', error);
    throw new Error(error.message || 'Failed to get message status');
  }
};

/**
 * Verify Twilio configuration
 */
exports.verifyConnection = async () => {
  try {
    const client = getClient();
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();

    return {
      success: true,
      message: 'Twilio configuration is valid',
      accountStatus: account.status,
    };
  } catch (error) {
    console.error('Twilio verification error:', error);
    return { success: false, message: error.message };
  }
};
