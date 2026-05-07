const express = require('express');
const paymentsController = require('../controllers/payments.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', paymentsController.list);
router.post('/', paymentsController.create);
router.get('/:id', paymentsController.get);
router.post('/process', paymentsController.process);

module.exports = router;
