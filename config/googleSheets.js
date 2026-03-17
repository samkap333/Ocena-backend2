const { google } = require('googleapis');

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
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set in .env');
  try {
    const parsed = JSON.parse(raw);
    // Ensure private_key newlines are real newlines (some platforms escape them)
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: ' + e.message);
  }
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
  ensureSheet,
};