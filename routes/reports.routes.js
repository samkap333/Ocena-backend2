const express = require('express');
const reports = require('../controllers/reports.controller');

const router = express.Router();

router.get('/overview', reports.overview);
router.get('/leads', reports.leads);
router.get('/revenue', reports.revenue);
router.get('/performance', reports.performance);
router.get('/export', reports.exportReport);

module.exports = router;
