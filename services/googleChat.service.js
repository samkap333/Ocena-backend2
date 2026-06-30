const { google } = require('googleapis');
const { Employee } = require('../models/crm');
const { Attendance, Holiday } = require('../models/hrms');

function getCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (e) {
    // Regex recovery fallback
    const emailMatch = raw.match(/"client_email"\s*:\s*"([^"]+)"/);
    const keyMatch = raw.match(/"private_key"\s*:\s*"([^"]+)"/s) || raw.match(/"private_key"\s*:\s*"([^"]+)"/);
    if (emailMatch && keyMatch) {
      const client_email = emailMatch[1];
      let private_key = keyMatch[1];
      private_key = private_key.replace(/\\n/g, '\n').replace(/\\\n/g, '\n').replace(/\\/g, '');
      return { client_email, private_key };
    }
    return null;
  }
}

async function getChatClient() {
  const clientId = process.env.GOOGLE_CHAT_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CHAT_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CHAT_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    console.log('Initializing Google Chat API client using User OAuth 2.0 credentials...');
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.chat({ version: 'v1', auth: oauth2Client });
  }

  console.log('Initializing Google Chat API client using Service Account credentials...');
  const credentials = getCredentials();
  if (!credentials) {
    throw new Error(
      'Google Chat integration is not configured. Please define either User OAuth variables (GOOGLE_CHAT_CLIENT_ID, GOOGLE_CHAT_CLIENT_SECRET, GOOGLE_CHAT_REFRESH_TOKEN) or GOOGLE_SERVICE_ACCOUNT_JSON in your backend .env file.'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/chat.spaces.readonly',
      'https://www.googleapis.com/auth/chat.messages.readonly'
    ],
  });

  const authClient = await auth.getClient();
  return google.chat({ version: 'v1', auth: authClient });
}

const getNormalizedDate = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Sync attendance logs from Google Chat Space
 * @param {string} spaceId 
 * @param {string} tenantId 
 */
exports.syncAttendanceFromChat = async (spaceId, tenantId) => {
  const chat = await getChatClient();
  
  console.log(`Syncing Google Chat space: ${spaceId} for tenant: ${tenantId}`);
  
  // List messages from Google Chat space (fetches last 100 messages)
  const response = await chat.spaces.messages.list({
    parent: spaceId,
    pageSize: 100,
  });

  const messages = response.data.messages || [];
  let syncCount = 0;
  const logs = [];

  // Sort messages chronologically so that clock-in is processed before clock-out
  messages.sort((a, b) => new Date(a.createTime) - new Date(b.createTime));

  for (const message of messages) {
    const text = (message.text || '').toLowerCase().trim();
    const createTime = new Date(message.createTime);
    const sender = message.sender || {};
    
    // Skip bot messages
    if (sender.type === 'BOT') continue;

    const email = sender.email || '';
    const displayName = sender.displayName || '';

    if (!email && !displayName) continue;

    // Find employee by email or name
    let employee = null;
    if (email) {
      employee = await Employee.findOne({ email: email.toLowerCase(), tenantId });
    }
    if (!employee && displayName) {
      employee = await Employee.findOne({ name: { $regex: new RegExp(`^${displayName}$`, 'i') }, tenantId });
    }

    if (!employee) {
      console.warn(`No employee found matching sender: ${displayName} (${email})`);
      continue;
    }

    const employeeId = employee._id;
    const today = getNormalizedDate(createTime);

    // Identify message intent
    const isClockIn = /^(login|in|clock in|clock-in|present|check in|check-in|signing in)$/.test(text) || text.includes('login') || text.includes('clock in');
    const isClockOut = /^(logout|out|clock out|clock-out|done|check out|check-out|signing out|leaving)$/.test(text) || text.includes('logout') || text.includes('clock out') || text.includes('leaving');

    if (isClockIn) {
      let attendance = await Attendance.findOne({ employeeId, date: today });
      if (!attendance) {
        // Determine status (Weekend, Holiday, or Present)
        let status = 'Present';
        const dayOfWeek = createTime.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          status = 'Weekend';
        }
        const isHoliday = await Holiday.findOne({ date: today, tenantId });
        if (isHoliday) {
          status = 'Holiday';
        }

        attendance = new Attendance({
          employeeId,
          date: today,
          clockIn: createTime,
          status,
          tenantId,
          notes: 'Synced from Google Chat Space'
        });
        await attendance.save();
        syncCount++;
        logs.push({ employeeName: employee.name, date: today.toLocaleDateString(), action: 'Clock-In', time: createTime });
      }
    } else if (isClockOut) {
      const attendance = await Attendance.findOne({ employeeId, date: today });
      if (attendance && attendance.clockIn && !attendance.clockOut) {
        attendance.clockOut = createTime;
        
        // Calculate working hours
        let totalMs = createTime - attendance.clockIn;
        let breakMs = 0;
        if (attendance.breaks && attendance.breaks.length > 0) {
          attendance.breaks.forEach(b => {
            if (b.start && b.end) {
              breakMs += (b.end - b.start);
            }
          });
        }
        
        const workingMs = totalMs - breakMs;
        attendance.totalWorkingHours = Math.max(0, workingMs / (1000 * 60 * 60));
        await attendance.save();
        syncCount++;
        logs.push({ employeeName: employee.name, date: today.toLocaleDateString(), action: 'Clock-Out', time: createTime });
      }
    }
  }

  return { syncCount, logs };
};
