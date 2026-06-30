const mongoose = require('mongoose');
const { Schema } = mongoose;

const objectId = Schema.Types.ObjectId;

// Shift Schema
const shiftSchema = new Schema({
  name: { type: String, required: true },
  startTime: { type: String, required: true }, // Format: "HH:MM" (e.g. "09:00")
  endTime: { type: String, required: true },   // Format: "HH:MM" (e.g. "17:00")
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

// Attendance Schema
const attendanceSchema = new Schema({
  employeeId: { type: objectId, ref: 'Employee', required: true, index: true },
  date: { type: Date, required: true, index: true }, // Normalized to midnight
  status: { 
    type: String, 
    enum: ['Present', 'Absent', 'Leave', 'Half Day', 'Late', 'Overtime', 'Holiday', 'Weekend'], 
    default: 'Present' 
  },
  clockIn: { type: Date },
  clockOut: { type: Date },
  breaks: [{
    start: { type: Date },
    end: { type: Date }
  }],
  totalWorkingHours: { type: Number, default: 0 }, // in hours
  manualEntry: { type: Boolean, default: false },
  latitude: { type: Number },
  longitude: { type: Number },
  notes: { type: String },
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

// Holiday Schema
const holidaySchema = new Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true, index: true },
  type: { type: String, enum: ['National', 'State', 'Company'], default: 'Company' },
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

// Leave Request Schema
const leaveRequestSchema = new Schema({
  employeeId: { type: objectId, ref: 'Employee', required: true, index: true },
  leaveType: { 
    type: String, 
    enum: ['Casual', 'Sick', 'Paid', 'Unpaid', 'Maternity', 'Paternity', 'Work From Home'], 
    required: true 
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', index: true },
  managerApproval: {
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approvedBy: { type: String },
    date: { type: Date }
  },
  hrApproval: {
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approvedBy: { type: String },
    date: { type: Date }
  },
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

// Leave Balance Schema
const leaveBalanceSchema = new Schema({
  employeeId: { type: objectId, ref: 'Employee', required: true, unique: true, index: true },
  year: { type: Number, required: true },
  casual: {
    allocated: { type: Number, default: 12 },
    used: { type: Number, default: 0 }
  },
  sick: {
    allocated: { type: Number, default: 10 },
    used: { type: Number, default: 0 }
  },
  paid: {
    allocated: { type: Number, default: 15 },
    used: { type: Number, default: 0 }
  },
  maternity: {
    allocated: { type: Number, default: 84 }, // ~12 weeks
    used: { type: Number, default: 0 }
  },
  paternity: {
    allocated: { type: Number, default: 15 },
    used: { type: Number, default: 0 }
  },
  wfh: {
    allocated: { type: Number, default: 24 },
    used: { type: Number, default: 0 }
  },
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

// Payroll Schema
const payrollSchema = new Schema({
  employeeId: { type: objectId, ref: 'Employee', required: true, index: true },
  month: { type: String, required: true, index: true }, // Format: YYYY-MM (e.g. "2026-06")
  basicSalary: { type: Number, required: true },
  hra: { type: Number, required: true },
  allowances: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  overtimeEarnings: { type: Number, default: 0 },
  pfDeduction: { type: Number, default: 0 },
  esiDeduction: { type: Number, default: 0 },
  ptDeduction: { type: Number, default: 0 },
  tdsDeduction: { type: Number, default: 0 },
  loanEmiDeduction: { type: Number, default: 0 },
  otherDeductions: { type: Number, default: 0 },
  grossSalary: { type: Number, required: true },
  netSalary: { type: Number, required: true },
  status: { type: String, enum: ['Draft', 'Processed', 'Paid', 'On Hold'], default: 'Draft', index: true },
  paymentDate: { type: Date },
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

// Document Schema
const documentSchema = new Schema({
  employeeId: { type: objectId, ref: 'Employee', required: false, index: true },
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['Resume', 'Offer Letter', 'Appointment Letter', 'ID Proof', 'Salary Certificate', 'Experience Letter', 'Payslip', 'Other'], 
    required: true 
  },
  fileUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

// HRMS Notification Schema
const hrmsNotificationSchema = new Schema({
  employeeId: { type: objectId, ref: 'Employee', required: true, index: true },
  type: { type: String, enum: ['Leave', 'Payroll', 'Attendance', 'Info'], required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false, index: true },
  tenantId: { type: objectId, ref: 'Tenant', required: true, index: true },
}, { timestamps: true });

module.exports = {
  Shift: mongoose.models.Shift || mongoose.model('Shift', shiftSchema),
  Attendance: mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema),
  Holiday: mongoose.models.Holiday || mongoose.model('Holiday', holidaySchema),
  LeaveRequest: mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', leaveRequestSchema),
  LeaveBalance: mongoose.models.LeaveBalance || mongoose.model('LeaveBalance', leaveBalanceSchema),
  Payroll: mongoose.models.Payroll || mongoose.model('Payroll', payrollSchema),
  Document: mongoose.models.Document || mongoose.model('Document', documentSchema),
  HrmsNotification: mongoose.models.HrmsNotification || mongoose.model('HrmsNotification', hrmsNotificationSchema),
};
