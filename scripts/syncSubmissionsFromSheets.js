require('dotenv').config();
const crypto = require('crypto');
require('../config/database');
const {
  CONTACT_SHEET,
  CAREER_SHEET,
  getRows,
} = require('../config/googleSheets');
const { ContactSubmission, CareerApplication } = require('../models/crm');

function rowKey(sheetName, row) {
  return `${sheetName}:${crypto.createHash('sha1').update(JSON.stringify(row)).digest('hex')}`;
}

function parseSheetDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
}

async function syncContacts() {
  const rows = await getRows(CONTACT_SHEET);
  let count = 0;

  for (const row of rows) {
    const [timestamp, name, email, phoneNumber, subject, message] = row;
    if (!name || !email) continue;

    await ContactSubmission.updateOne(
      { sourceRowKey: rowKey(CONTACT_SHEET, row) },
      {
        $setOnInsert: {
          submittedAt: parseSheetDate(timestamp),
          name,
          email,
          phoneNumber: phoneNumber || '',
          subject: subject || '',
          message: message || '',
          source: 'google-sheet-import',
          sourceRowKey: rowKey(CONTACT_SHEET, row),
        },
      },
      { upsert: true }
    );
    count += 1;
  }

  return count;
}

async function syncCareers() {
  const rows = await getRows(CAREER_SHEET);
  let count = 0;

  for (const row of rows) {
    const [
      timestamp,
      jobTitle,
      department,
      jobType,
      jobLocation,
      fullName,
      email,
      phone,
      currentLocation,
      linkedIn,
      yearsOfExperience,
      expectedCTC,
      resumeLink,
    ] = row;
    if (!fullName || !email || !jobTitle) continue;

    await CareerApplication.updateOne(
      { sourceRowKey: rowKey(CAREER_SHEET, row) },
      {
        $setOnInsert: {
          appliedAt: parseSheetDate(timestamp),
          jobTitle,
          department: department || '',
          jobType: jobType || '',
          jobLocation: jobLocation || '',
          fullName,
          email,
          phone: phone || '',
          currentLocation: currentLocation || '',
          linkedIn: linkedIn || '',
          yearsOfExperience: yearsOfExperience || '',
          expectedCTC: expectedCTC || '',
          resumeLink: resumeLink || '',
          source: 'google-sheet-import',
          sourceRowKey: rowKey(CAREER_SHEET, row),
        },
      },
      { upsert: true }
    );
    count += 1;
  }

  return count;
}

async function main() {
  const [contacts, careers] = await Promise.all([syncContacts(), syncCareers()]);
  console.log(`Synced ${contacts} contact rows and ${careers} career rows from Google Sheets.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Failed to sync submissions from Google Sheets:', error);
  process.exit(1);
});
