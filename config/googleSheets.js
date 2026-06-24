const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Set in your .env
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Sheet tab names
const CONTACT_SHEET = 'Contact';
const CAREER_SHEET  = 'Career';
const EMAIL_SHEET   = 'EmailSubscribers';

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Instead of reading the .json key file (which would get committed to GitHub),
// we store the entire JSON content as a single env variable GOOGLE_SERVICE_ACCOUNT_JSON.
// The private_key has literal \n characters in .env — we replace them back to real newlines.

function getCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  if (!raw) throw new Error('Google service account credentials are not set in .env');
  try {
    const parsed = JSON.parse(raw);
    // Ensure private_key newlines are real newlines (some platforms escape them)
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (e) {
    console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_JSON from process.env:', e.message);
    if (raw) {
      console.error('raw env var length:', raw.length);
      console.error('raw env var start:', raw.substring(0, 250));
      const posMatch = e.message.match(/position (\d+)/);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        console.error('Context around error position:', JSON.stringify(raw.substring(Math.max(0, pos - 30), Math.min(raw.length, pos + 30))));
      }

      // Robust fallback: Extract credentials via regex if JSON parsing fails
      try {
        const emailMatch = raw.match(/"client_email"\s*:\s*"([^"]+)"/);
        const keyMatch = raw.match(/"private_key"\s*:\s*"([^"]+)"/s) || raw.match(/"private_key"\s*:\s*"([^"]+)"/);
        if (emailMatch && keyMatch) {
          const client_email = emailMatch[1];
          let private_key = keyMatch[1];
          // Convert \n or \\n into actual newlines, and remove escaping backslashes if present
          private_key = private_key.replace(/\\n/g, '\n').replace(/\\\n/g, '\n').replace(/\\/g, '');
          console.log('Successfully recovered credentials via regex fallback!');
          return { client_email, private_key };
        }
      } catch (recoveryError) {
        console.error('Regex credentials recovery failed:', recoveryError.message);
      }
    }
    const parsedFromFile = readServiceAccountJsonFromEnvFile();
    if (parsedFromFile) return parsedFromFile;
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: ' + e.message);
  }
}

function readServiceAccountJsonFromEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return null;

  const envFile = fs.readFileSync(envPath, 'utf8');
  const marker = 'GOOGLE_SERVICE_ACCOUNT_JSON=';
  const start = envFile.indexOf(marker);
  if (start === -1) return null;

  const jsonStart = envFile.indexOf('{', start + marker.length);
  if (jsonStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = jsonStart; index < envFile.length; index += 1) {
    const char = envFile[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      const rawJson = envFile.slice(jsonStart, index + 1);
      const parsed = JSON.parse(rawJson);
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      return parsed;
    }
  }

  return null;
}

async function getAuthClient() {
  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,                                          // ← object, not keyFile path
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
}

// ─── Sheets helpers ───────────────────────────────────────────────────────────

async function appendRow(sheetName, values) {
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
}

async function getRows(sheetName) {
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:Z`,
  });
  return result.data.values || [];
}

async function ensureSheet(sheetName, headerRow) {
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = meta.data.sheets.map((s) => s.properties.title);
  if (!existing.includes(sheetName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headerRow] },
    });
  }
}

// ─── Header rows ──────────────────────────────────────────────────────────────

const CONTACT_HEADERS = ['Timestamp', 'Name', 'Email', 'Phone', 'Subject', 'Message'];

const CAREER_HEADERS = [
  'Timestamp',
  'Job Title',
  'Department',
  'Job Type',
  'Job Location',
  'Full Name',
  'Email',
  'Phone',
  'Current Location',
  'LinkedIn',
  'Years of Experience',
  'Expected CTC',
  'Resume Link',
];

const EMAIL_HEADERS = ['Timestamp', 'Email'];

module.exports = {
  SPREADSHEET_ID,
  CONTACT_SHEET,
  CAREER_SHEET,
  EMAIL_SHEET,
  CONTACT_HEADERS,
  CAREER_HEADERS,
  EMAIL_HEADERS,
  appendRow,
  getRows,
  ensureSheet,
};
