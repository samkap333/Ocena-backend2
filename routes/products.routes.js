const express = require('express');
const productsController = require('../controllers/products.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Product CRUD
router.get('/', productsController.list);
router.post('/', productsController.create);
router.get('/stats', productsController.stats);
router.get('/categories', productsController.categories);
router.get('/:id', productsController.get);
router.patch('/:id', productsController.update);
router.delete('/:id', productsController.remove);

module.exports = router;
