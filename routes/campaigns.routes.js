const express = require('express');
const campaigns = require('../controllers/campaigns.controller');

const router = express.Router();

function mount(type) {
  const crud = campaigns.crud(type);
  router.get(`/${type}`, crud.list);
  router.post(`/${type}`, crud.create);
  router.get(`/${type}/:id`, crud.get);
  router.patch(`/${type}/:id`, crud.update);
  router.delete(`/${type}/:id`, crud.remove);
  router.get(`/${type}/:id/stats`, campaigns.stats(type));
  router.post(`/${type}/:id/send`, campaigns.send(type));
  router.post(`/${type}/:id/pause`, campaigns.pause(type));
  router.post(`/${type}/:id/resume`, campaigns.resume(type));
}

mount('email');
mount('whatsapp');
mount('facebook');

module.exports = router;
