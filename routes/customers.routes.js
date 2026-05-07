const express = require('express');
const customersController = require('../controllers/customers.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Customer CRUD
router.get('/', customersController.list);
router.post('/', customersController.create);
router.get('/stats', customersController.stats);
router.post('/convert-from-lead', customersController.convertFromLead);
router.get('/:id', customersController.get);
router.patch('/:id', customersController.update);
router.delete('/:id', customersController.remove);

module.exports = router;
