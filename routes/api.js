const express = require('express');
const router = express.Router();
const {
  CONTACT_SHEET,
  CONTACT_HEADERS,
  appendRow,
  ensureSheet,
} = require('../config/googleSheets');

// POST /contact-info-user  — saves to Google Sheets "Contact" tab (no MongoDB)
router.post('/contact-info-user', async (req, res) => {
  try {
    const { name, phoneNumber, email, subject, message } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    // Ensure the Contact tab exists with headers
    await ensureSheet(CONTACT_SHEET, CONTACT_HEADERS);

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    await appendRow(CONTACT_SHEET, [
      timestamp,
      name         || '',
      email        || '',
      phoneNumber  || '',
      subject      || '',
      message      || '',
    ]);

    return res.status(201).json({ message: 'Contact information saved successfully' });
  } catch (error) {
    console.error('Contact route error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /contact-info-user
router.get('/contact-info-user', (req, res) => {
  res.json({ message: 'Contact data is stored in Google Sheets.' });
});

module.exports = router;