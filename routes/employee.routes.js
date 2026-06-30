const express = require('express');
const employeeController = require('../controllers/employee.controller');
const authMiddleware = require('../middleware/auth.middleware');
const tenantMiddleware = require('../middleware/tenant.middleware');
const employeeAuth = require('../middleware/employeeAuth.middleware');

const router = express.Router();

// Public employee portal routes
router.post('/login', employeeController.login);
router.post('/activate', employeeController.activate);
router.post('/update-pan', employeeController.updatePan);
router.post('/forgot-password', employeeController.forgotPassword);
router.post('/reset-password', employeeController.resetPassword);

// Employee protected self routes
router.get('/profile', employeeAuth, employeeController.getProfile);
router.put('/profile', employeeAuth, employeeController.updateProfile);

// Admin protected employee management routes
router.get('/', authMiddleware, tenantMiddleware, employeeController.list);
router.post('/', authMiddleware, tenantMiddleware, employeeController.create);
router.post('/send-invite', authMiddleware, tenantMiddleware, employeeController.sendInvite);
router.put('/:email', authMiddleware, tenantMiddleware, employeeController.update);
router.delete('/:email', authMiddleware, tenantMiddleware, employeeController.remove);

module.exports = router;
