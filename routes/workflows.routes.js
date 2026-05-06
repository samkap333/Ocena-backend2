const createCrudController = require('../controllers/crudController');
const crudRoutes = require('./crud.routes');
const { Workflow } = require('../models/crm');

const router = crudRoutes(createCrudController('Workflow'));
router.post('/:id/toggle', async (req, res, next) => {
  try {
    const workflow = await Workflow.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });
    workflow.enabled = !workflow.enabled;
    await workflow.save();
    return res.json(workflow);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
