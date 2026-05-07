const express = require('express');
const settingsController = require('../controllers/settings.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/profile', settingsController.getProfile);
router.patch('/profile', settingsController.updateProfile);
router.patch('/password', settingsController.updatePassword);
router.get('/preferences', settingsController.getPreferences);
router.patch('/preferences', settingsController.updatePreferences);

module.exports = router;
