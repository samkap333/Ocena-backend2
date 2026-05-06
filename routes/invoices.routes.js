const createCrudController = require('../controllers/crudController');
const crudRoutes = require('./crud.routes');

const router = crudRoutes(createCrudController('Invoice'));
router.post('/:id/send', (req, res) => res.json({ message: 'Invoice queued for email delivery' }));
router.get('/:id/pdf', (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from(''));
});

module.exports = router;
