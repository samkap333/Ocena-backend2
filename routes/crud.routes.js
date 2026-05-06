const express = require('express');

function crudRoutes(controller) {
  const router = express.Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);
  return router;
}

module.exports = crudRoutes;
