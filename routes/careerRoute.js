const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const {
  CAREER_SHEET,
  CAREER_HEADERS,
  appendRow,
  ensureSheet,
} = require('../config/googleSheets');

// ─── Cloudinary config (reads from .env) ─────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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

// ─── Upload buffer to Cloudinary ─────────────────────────────────────────────
function uploadToCloudinary(buffer, fileName) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',          // required for non-image files (PDF, DOCX)
        folder: 'ocena_resumes',       // organise in a folder in your Cloudinary account
        public_id: fileName,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);    // https://... link saved in the sheet
      }
    );
    uploadStream.end(buffer);
  });
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

    // ── Upload resume to Cloudinary ──────────────────────────────
    let resumeLink = 'No resume uploaded';

    if (req.file) {
      const safeName = `${fullName.replace(/\s+/g, '_')}_${Date.now()}`;
      resumeLink = await uploadToCloudinary(req.file.buffer, safeName);
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
      resumeLink,                // Cloudinary URL — clickable in Sheets
    ]);

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