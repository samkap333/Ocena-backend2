const express = require('express');
const auth = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/login', auth.login);
router.post('/register', auth.register);
router.post('/refresh', auth.refresh);
router.get('/me', authMiddleware, auth.me);
router.post('/logout', authMiddleware, auth.logout);

module.exports = router;
