const express = require('express');
const router = express.Router();
const {
  EMAIL_SHEET,
  EMAIL_HEADERS,
  appendRow,
  ensureSheet,
} = require('../config/googleSheets');

// POST /contact-email  — saves to Google Sheets "EmailSubscribers" tab (no MongoDB)
router.post('/contact-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    await ensureSheet(EMAIL_SHEET, EMAIL_HEADERS);

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    await appendRow(EMAIL_SHEET, [timestamp, email]);

    return res.status(201).json({ message: 'Email saved successfully', email });
  } catch (error) {
    console.error('Error saving email:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/contact-email', (req, res) => {
  res.json({ message: 'Email subscribers are stored in Google Sheets.' });
});

module.exports = router;