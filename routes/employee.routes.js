const express = require('express');
const employeeController = require('../controllers/employee.controller');
const authMiddleware = require('../middleware/auth.middleware');
const tenantMiddleware = require('../middleware/tenant.middleware');

const router = express.Router();

// Public employee portal routes
router.post('/login', employeeController.login);
router.post('/activate', employeeController.activate);
router.post('/update-pan', employeeController.updatePan);
router.post('/forgot-password', employeeController.forgotPassword);
router.post('/reset-password', employeeController.resetPassword);

// Admin protected employee management routes
router.get('/', authMiddleware, tenantMiddleware, employeeController.list);
router.post('/', authMiddleware, tenantMiddleware, employeeController.create);
router.put('/:email', authMiddleware, tenantMiddleware, employeeController.update);
router.delete('/:email', authMiddleware, tenantMiddleware, employeeController.remove);

module.exports = router;
