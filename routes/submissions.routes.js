const express = require('express');
const submissionsController = require('../controllers/submissions.controller');

const router = express.Router();

router.get('/contacts', submissionsController.listContacts);
router.get('/careers', submissionsController.listCareers);

module.exports = router;
