const express = require('express');
const dealsController = require('../controllers/deals.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Deal CRUD
router.get('/', dealsController.list);
router.post('/', dealsController.create);
router.get('/stats', dealsController.stats);
router.get('/pipeline', dealsController.pipeline);
router.post('/convert-from-lead', dealsController.convertFromLead);
router.get('/:id', dealsController.get);
router.patch('/:id', dealsController.update);
router.delete('/:id', dealsController.remove);

module.exports = router;
