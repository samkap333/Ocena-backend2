const createCrudController = require('../controllers/crudController');
const crudRoutes = require('./crud.routes');
const { TicketMessage } = require('../models/crm');

const router = crudRoutes(createCrudController('Ticket'));

router.get('/:id/messages', async (req, res, next) => {
  try {
    const data = await TicketMessage.find({ ticketId: req.params.id }).sort({ createdAt: 1 }).lean();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/messages', async (req, res, next) => {
  try {
    const message = await TicketMessage.create({ ticketId: req.params.id, message: req.body.message, createdBy: req.user?.id });
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
