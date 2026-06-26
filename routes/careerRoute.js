const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const path       = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const {
  CAREER_SHEET,
  CAREER_HEADERS,
  appendRow,
  ensureSheet,
} = require('../config/googleSheets');
const { CareerApplication } = require('../models/crm');

// ─── AWS S3 config (reads from .env) ─────────────────────────────────────────
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ─── Multer — memory storage ──────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only PDF and Word documents (.doc / .docx) are accepted.'));
  },
});

// ─── Upload buffer to AWS S3 ─────────────────────────────────────────────────
async function uploadToS3(buffer, fileName, mimeType) {
  const bucketName = process.env.AWS_BUCKET_NAME;
  const region = process.env.AWS_REGION;

  if (!bucketName || !region || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS S3 environment variables are not fully configured.');
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: `resumes/${fileName}`,
    Body: buffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);

  // Return the public S3 URL
  return `https://${bucketName}.s3.${region}.amazonaws.com/resumes/${fileName}`;
}

// ─── POST /career-application ─────────────────────────────────────────────────
router.post('/career-application', upload.single('resume'), async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      currentLocation,
      linkedIn,
      yearsOfExperience,
      expectedCTC,
      jobTitle,
      department,
      jobType,
      jobLocation,
      appliedAt,
    } = req.body;

    if (!fullName || !email || !jobTitle) {
      return res.status(400).json({ error: 'fullName, email, and jobTitle are required.' });
    }

    // ── Upload resume to AWS S3 ──────────────────────────────────
    let resumeLink = 'No resume uploaded';

    if (req.file) {
      const ext = path.extname(req.file.originalname) || '.pdf';
      const safeName = `${fullName.replace(/\s+/g, '_')}_${Date.now()}${ext}`;
      resumeLink = await uploadToS3(req.file.buffer, safeName, req.file.mimetype);
    } else if (req.body.resumeLink) {
      resumeLink = req.body.resumeLink;
    }

    // ── Save row to Google Sheet ─────────────────────────────────
    await ensureSheet(CAREER_SHEET, CAREER_HEADERS);

    const timestamp = appliedAt || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    await appendRow(CAREER_SHEET, [
      timestamp,
      jobTitle          || '',
      department        || '',
      jobType           || '',
      jobLocation       || '',
      fullName,
      email,
      phone             || '',
      currentLocation   || '',
      linkedIn          || '',
      yearsOfExperience || '',
      expectedCTC       || '',
      resumeLink,                // S3 URL — clickable in Sheets
    ]);

    await CareerApplication.create({
      fullName,
      email,
      phone: phone || '',
      currentLocation: currentLocation || '',
      linkedIn: linkedIn || '',
      yearsOfExperience: yearsOfExperience || '',
      expectedCTC: expectedCTC || '',
      jobTitle,
      department: department || '',
      jobType: jobType || '',
      jobLocation: jobLocation || '',
      resumeLink,
      appliedAt: new Date(),
      source: 'website',
    });

    return res.status(201).json({ message: 'Application submitted successfully.' });
  } catch (error) {
    console.error('Career application error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
});

router.get('/career-application', (req, res) => {
  res.json({ message: 'Career applications are stored in Google Sheets.' });
});

module.exports = router;
