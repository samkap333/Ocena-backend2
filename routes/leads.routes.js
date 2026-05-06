const createCrudController = require('../controllers/crudController');
const crudRoutes = require('./crud.routes');

module.exports = crudRoutes(createCrudController('Lead'));
