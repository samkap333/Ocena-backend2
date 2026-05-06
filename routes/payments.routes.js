const createCrudController = require('../controllers/crudController');
const crudRoutes = require('./crud.routes');
const paymentService = require('../services/payment.service');

const router = crudRoutes(createCrudController('Payment'));
router.post('/process', async (req, res, next) => {
  try {
    res.json(await paymentService.processPayment(req.body));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
