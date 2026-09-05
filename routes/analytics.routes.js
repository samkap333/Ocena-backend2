const express = require('express');
const analyticsController = require('../controllers/analytics.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Public ingestion routes
router.post('/collect', analyticsController.collect);
router.get('/tracker.js', analyticsController.getTrackerScript);

// Protected CRM routes
router.get('/stats', authMiddleware, analyticsController.getStats);
router.get('/live', authMiddleware, analyticsController.getLive);

module.exports = router;
