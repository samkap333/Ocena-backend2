const express = require('express');
const invoicesController = require('../controllers/invoices.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', invoicesController.list);
router.post('/', invoicesController.create);
router.get('/:id', invoicesController.get);
router.patch('/:id', invoicesController.update);
router.delete('/:id', invoicesController.remove);
router.post('/:id/send', invoicesController.send);
router.get('/:id/pdf', invoicesController.pdf);

module.exports = router;
