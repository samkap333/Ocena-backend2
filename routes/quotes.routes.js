const express = require('express');
const quotesController = require('../controllers/quotes.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Quote CRUD
router.get('/', quotesController.list);
router.post('/', quotesController.create);
router.get('/:id', quotesController.get);
router.patch('/:id', quotesController.update);
router.delete('/:id', quotesController.remove);

// Quote actions
router.post('/:id/send', quotesController.send);
router.get('/:id/pdf', quotesController.pdf);
router.post('/:id/accept', quotesController.accept);
router.post('/:id/reject', quotesController.reject);
router.post('/:id/convert-to-invoice', quotesController.convertToInvoice);

module.exports = router;
