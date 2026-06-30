const express = require('express');
const hrmsController = require('../controllers/hrms.controller');
const authMiddleware = require('../middleware/auth.middleware');
const tenantMiddleware = require('../middleware/tenant.middleware');
const employeeAuth = require('../middleware/employeeAuth.middleware');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

const router = express.Router();

// ==========================================
// EMPLOYEE PORTAL SECURED ROUTES
// ==========================================

// Employee Dashboard & Profiles
router.get('/dashboard/employee', employeeAuth, hrmsController.getEmployeeDashboardStats);

// Attendance Actions
router.post('/attendance/clock-in', employeeAuth, hrmsController.clockIn);
router.post('/attendance/clock-out', employeeAuth, hrmsController.clockOut);
router.post('/attendance/break-start', employeeAuth, hrmsController.startBreak);
router.post('/attendance/break-end', employeeAuth, hrmsController.endBreak);
router.get('/attendance/my-attendance', employeeAuth, hrmsController.getMyAttendance);

// Leaves Actions
router.post('/leaves/apply', employeeAuth, hrmsController.applyLeave);
router.get('/leaves/my-leaves', employeeAuth, hrmsController.getMyLeaves);
router.get('/leaves/balance', employeeAuth, hrmsController.getLeaveBalance);

// Documents Actions
router.get('/documents/my-docs', employeeAuth, hrmsController.getMyDocs);
router.post('/documents/upload-self', employeeAuth, hrmsController.uploadDoc);
router.get('/documents/hr-policy', employeeAuth, hrmsController.getHrPolicy);
router.post('/documents/upload-policy', employeeAuth, upload.single('policyFile'), hrmsController.uploadHrPolicy);

// Payslip Download (for employees)
router.get('/payroll/:id/payslip/employee', employeeAuth, hrmsController.downloadPayslip);


// ==========================================
// ADMIN / HR / FINANCE SECURED ROUTES
// ==========================================

const adminAuth = [authMiddleware, tenantMiddleware];

// Admin Dashboard
router.get('/dashboard/admin', adminAuth, hrmsController.getAdminDashboardStats);

// Shift CRUD
router.get('/shifts', adminAuth, hrmsController.listShifts);
router.post('/shifts', adminAuth, hrmsController.createShift);
router.put('/shifts/:id', adminAuth, hrmsController.updateShift);
router.delete('/shifts/:id', adminAuth, hrmsController.deleteShift);

// Holiday CRUD
router.get('/holidays', adminAuth, hrmsController.listHolidays);
router.post('/holidays', adminAuth, hrmsController.createHoliday);
router.delete('/holidays/:id', adminAuth, hrmsController.deleteHoliday);

// Attendance Admin Actions
router.get('/attendance', adminAuth, hrmsController.getAttendanceList);
router.post('/attendance/manual', adminAuth, hrmsController.manualAttendance);
router.post('/attendance/sync-google-chat', adminAuth, hrmsController.syncGoogleChatAttendance);

// Leave Requests Admin Actions
router.get('/leaves', adminAuth, hrmsController.listLeaves);
router.post('/leaves/:id/approve', adminAuth, hrmsController.approveLeave);

// Payroll & Payslips Admin Actions
router.get('/payroll', adminAuth, hrmsController.listPayroll);
router.post('/payroll/generate', adminAuth, hrmsController.generatePayroll);
router.post('/payroll/regenerate/:id', adminAuth, hrmsController.regeneratePayroll);
router.put('/payroll/:id/status', adminAuth, hrmsController.updatePayrollStatus);
router.get('/payroll/:id/payslip', adminAuth, hrmsController.downloadPayslip);

// Documents Admin Actions
router.get('/documents', adminAuth, hrmsController.listAllDocs);
router.post('/documents', adminAuth, hrmsController.uploadDoc);
router.get('/documents/hr-policy-admin', adminAuth, hrmsController.getHrPolicy);
router.post('/documents/upload-policy-admin', adminAuth, upload.single('policyFile'), hrmsController.uploadHrPolicy);

module.exports = router;
