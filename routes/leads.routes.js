const express = require('express');
const multer = require('multer');
const leadsController = require('../controllers/leads.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Configure multer for CSV upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// Lead CRUD
router.get('/', leadsController.list);
router.post('/', leadsController.create);
router.get('/stats', leadsController.stats);
router.get('/export', leadsController.export);
router.post('/import', upload.single('file'), leadsController.import);
router.get('/:id', leadsController.get);
router.patch('/:id', leadsController.update);
router.delete('/:id', leadsController.remove);

// Lead activities
router.get('/:id/activities', leadsController.activities);
router.post('/:id/activities', leadsController.addActivity);

// Lead actions
router.post('/:id/convert', leadsController.convert);
router.post('/:id/score', leadsController.score);

module.exports = router;
