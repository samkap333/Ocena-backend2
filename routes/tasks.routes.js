const createCrudController = require('../controllers/crudController');
const crudRoutes = require('./crud.routes');
const { Task } = require('../models/crm');

const router = crudRoutes(createCrudController('Task'));
router.post('/:id/complete', async (req, res, next) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { status: 'completed' },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    return res.json(task);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
