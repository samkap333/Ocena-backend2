const express = require('express');
const tasksController = require('../controllers/tasks.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', tasksController.list);
router.post('/', tasksController.create);
router.get('/:id', tasksController.get);
router.patch('/:id', tasksController.update);
router.delete('/:id', tasksController.remove);
router.post('/:id/complete', tasksController.complete);

module.exports = router;
