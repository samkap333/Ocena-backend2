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
      'https://www.googleapis.com/auth/chat.messages.readonly',
      'https://www.googleapis.com/auth/chat.memberships.readonly'
    ],
  });

  const authClient = await auth.getClient();
  return google.chat({ version: 'v1', auth: authClient });
}

const getNormalizedDate = (d) => {
  const date = new Date(d);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year').value, 10);
  const month = parseInt(parts.find(p => p.type === 'month').value, 10) - 1;
  const day = parseInt(parts.find(p => p.type === 'day').value, 10);
  return new Date(Date.UTC(year, month, day));
};

/**
 * Sync attendance logs from Google Chat Space
 * @param {string} spaceId 
 * @param {string} tenantId 
 */
exports.syncAttendanceFromChat = async (spaceId, tenantId) => {
  const chat = await getChatClient();
  
  // Google Chat Space ID must be prefixed with "spaces/"
  let parentSpaceId = spaceId.trim();
  if (!parentSpaceId.startsWith('spaces/')) {
    parentSpaceId = `spaces/${parentSpaceId}`;
  }

  console.log(`Syncing Google Chat space: ${parentSpaceId} for tenant: ${tenantId}`);
  
  let response;
  const memberMap = new Map();
  try {
    // 1. Fetch memberships to build a map of user ID -> email/name
    console.log(`[Google Chat Sync] Fetching members for space: ${parentSpaceId}`);
    const membersResponse = await chat.spaces.members.list({
      parent: parentSpaceId,
      pageSize: 100,
    });
    const memberships = membersResponse.data.memberships || [];
    for (const membership of memberships) {
      const u = membership.member || {};
      if (u.name) {
        memberMap.set(u.name, {
          displayName: u.displayName || '',
          email: u.email || '',
        });
      }
    }
    console.log(`[Google Chat Sync] Successfully mapped ${memberMap.size} space members.`);
  } catch (membersErr) {
    console.warn('[Google Chat Sync] Google Chat memberships API failed (insufficient scopes or permissions). Sync will fall back to using message sender details directly:', membersErr.message);
  }

  try {
    // List messages from Google Chat space (fetches last 100 messages)
    response = await chat.spaces.messages.list({
      parent: parentSpaceId,
      pageSize: 100,
    });
  } catch (err) {
    console.error('Google Chat API error details:', err);
    const friendlyError = new Error(`Failed to list messages from Google Chat Space (${parentSpaceId}). Please ensure the space exists, the service account/OAuth user is added to the space, and the Space ID is correct.`);
    friendlyError.status = 400; // Return 400 Bad Request instead of raw 404
    throw friendlyError;
  }

  const messages = response.data.messages || [];
  let syncCount = 0;
  const logs = [];

  console.log(`[Google Chat Sync] Total messages fetched: ${messages.length}`);

  // Sort messages chronologically so that clock-in is processed before clock-out
  messages.sort((a, b) => new Date(a.createTime) - new Date(b.createTime));

  for (const message of messages) {
    const text = (message.text || '').toLowerCase().trim();
    const createTime = new Date(message.createTime);
    const sender = message.sender || {};
    
    // Skip bot messages
    if (sender.type === 'BOT') {
      console.log(`[Google Chat Sync] Skipping bot message: "${text}"`);
      continue;
    }

    let email = sender.email || '';
    let displayName = sender.displayName || '';

    // If sender email/displayName are missing, look them up from the memberships map
    if ((!email || !displayName) && sender.name && memberMap.has(sender.name)) {
      const mapped = memberMap.get(sender.name);
      email = mapped.email;
      displayName = mapped.displayName;
    }

    console.log(`[Google Chat Sync] Processing message: "${message.text}" from "${displayName}" (${email}) at ${createTime.toISOString()}`);
    console.log(`[Google Chat Sync] Raw sender object: ${JSON.stringify(sender)}`);

    // Find employee by googleChatUserId first (most reliable when scopes are missing)
    let employee = null;
    if (sender.name) {
      employee = await Employee.findOne({ googleChatUserId: sender.name, tenantId });
    }
    if (!employee && email) {
      employee = await Employee.findOne({ email: email.toLowerCase(), tenantId });
    }
    if (!employee && displayName) {
      employee = await Employee.findOne({ name: { $regex: new RegExp(`^${displayName}$`, 'i') }, tenantId });
    }

    if (!employee) {
      console.warn(`[Google Chat Sync] No employee found matching sender: ID "${sender.name}", Name "${displayName}", Email "${email}"`);
      continue;
    }

    console.log(`[Google Chat Sync] Matched employee: ${employee.name} (${employee.email})`);

    const employeeId = employee._id;
    const today = getNormalizedDate(createTime);

    const cleanedText = text.replace(/[^a-z0-9\s():-]/g, '').trim();

    // Check Clock In
    const isClockIn = 
      /^(in|login|present|check\s*in|check-in|signin|signing\s*in|clock\s*in|clock-in)\b/.test(cleanedText) ||
      cleanedText.startsWith('in ') ||
      cleanedText.startsWith('in:') ||
      cleanedText === 'in';

    // Check Clock Out
    const isClockOut = 
      /^(out|logout|check\s*out|check-out|done|signout|signing\s*out|clock\s*out|clock-out|leaving)\b/.test(cleanedText) ||
      cleanedText.startsWith('out ') ||
      cleanedText.startsWith('out:') ||
      cleanedText === 'out';

    // Check Break Start
    const isBreakStart = 
      /^(break|tea\s*break|lunch\s*break|snack\s*break)\b/.test(cleanedText) && 
      !/^(break\s*over|break\s*end|break\s*off|break\s*done|break\s*stop|break\s*finish)/.test(cleanedText);

    // Check Break End
    const isBreakEnd = 
      /^(break\s*over|break\s*end|break\s*off|break\s*done|break\s*stop|break\s*finish|over\b)/.test(cleanedText);

    console.log(`[Google Chat Sync] Intent matches - isClockIn: ${isClockIn}, isClockOut: ${isClockOut}, isBreakStart: ${isBreakStart}, isBreakEnd: ${isBreakEnd}`);

    // Parse custom time from text if present (e.g. "In 9:20", "Out :7:18")
    let eventTime = createTime;
    const timeMatch = text.match(/\b(\d{1,2})[:.](\d{2})\b/);
    if (timeMatch) {
      const parsedHour = parseInt(timeMatch[1], 10);
      const parsedMinute = parseInt(timeMatch[2], 10);
      
      // Helper to construct Date in Asia/Kolkata timezone
      const getISTDateWithTime = (refTime, hour, minute) => {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric'
        });
        const parts = formatter.formatToParts(refTime);
        const y = parseInt(parts.find(p => p.type === 'year').value, 10);
        const m = parseInt(parts.find(p => p.type === 'month').value, 10) - 1;
        const d = parseInt(parts.find(p => p.type === 'day').value, 10);
        
        // Construct UTC time for that hour/minute
        const utcMs = Date.UTC(y, m, d, hour, minute, 0, 0);
        // IST is UTC + 5:30, so UTC = IST - 5:30 (19,800,000 ms)
        return new Date(utcMs - 19800000);
      };
      
      const candidate1 = getISTDateWithTime(createTime, parsedHour, parsedMinute);
      const candidate2 = getISTDateWithTime(createTime, (parsedHour + 12) % 24, parsedMinute);
      
      eventTime = Math.abs(candidate1 - createTime) < Math.abs(candidate2 - createTime) ? candidate1 : candidate2;
      console.log(`[Google Chat Sync] Parsed custom time "${parsedHour}:${parsedMinute}" -> Resolved as: ${eventTime.toISOString()}`);
    }

    if (isClockIn) {
      let attendance = await Attendance.findOne({ employeeId, date: today });
      if (!attendance) {
        // Determine status (Weekend, Holiday, or Present)
        let status = 'Present';
        const dayOfWeek = eventTime.getDay();
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
          clockIn: eventTime,
          status,
          tenantId,
          notes: 'Synced from Google Chat Space'
        });
        await attendance.save();
        syncCount++;
        logs.push({ employeeName: employee.name, date: today.toLocaleDateString('en-IN'), action: 'Clock-In', time: eventTime });
      }
    } else if (isClockOut) {
      const attendance = await Attendance.findOne({ employeeId, date: today });
      if (attendance && attendance.clockIn && !attendance.clockOut) {
        attendance.clockOut = eventTime;
        
        // Calculate working hours
        let totalMs = eventTime - attendance.clockIn;
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
        logs.push({ employeeName: employee.name, date: today.toLocaleDateString('en-IN'), action: 'Clock-Out', time: eventTime });
      }
    } else if (isBreakStart) {
      const attendance = await Attendance.findOne({ employeeId, date: today });
      if (attendance && attendance.clockIn && !attendance.clockOut) {
        if (!attendance.breaks) {
          attendance.breaks = [];
        }
        const activeBreak = attendance.breaks.find(b => !b.end);
        if (!activeBreak) {
          attendance.breaks.push({ start: eventTime });
          await attendance.save();
          syncCount++;
          logs.push({ employeeName: employee.name, date: today.toLocaleDateString('en-IN'), action: 'Break-Start', time: eventTime });
        }
      }
    } else if (isBreakEnd) {
      const attendance = await Attendance.findOne({ employeeId, date: today });
      if (attendance && attendance.clockIn && !attendance.clockOut && attendance.breaks) {
        const activeBreak = attendance.breaks.find(b => !b.end);
        if (activeBreak) {
          activeBreak.end = eventTime;
          
          if (attendance.clockOut) {
            let totalMs = attendance.clockOut - attendance.clockIn;
            let breakMs = 0;
            attendance.breaks.forEach(b => {
              if (b.start && b.end) {
                breakMs += (b.end - b.start);
              }
            });
            const workingMs = totalMs - breakMs;
            attendance.totalWorkingHours = Math.max(0, workingMs / (1000 * 60 * 60));
          }
          
          await attendance.save();
          syncCount++;
          logs.push({ employeeName: employee.name, date: today.toLocaleDateString('en-IN'), action: 'Break-End', time: eventTime });
        }
      }
    }
  }

  return { syncCount, logs };
};
