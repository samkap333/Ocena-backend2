const { Employee, Tenant } = require('../models/crm');
const { 
  Shift, 
  Attendance, 
  Holiday, 
  LeaveRequest, 
  LeaveBalance, 
  Payroll, 
  Document, 
  HrmsNotification 
} = require('../models/hrms');
const { generatePayslipPdf } = require('../services/payslip.service');
const googleChatService = require('../services/googleChat.service');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ==========================================
// 1. SHIFT MANAGEMENT
// ==========================================

exports.listShifts = async (req, res, next) => {
  try {
    const shifts = await Shift.find({ tenantId: req.user.tenantId }).sort({ name: 1 });
    res.json(shifts);
  } catch (error) {
    next(error);
  }
};

exports.createShift = async (req, res, next) => {
  try {
    const { name, startTime, endTime } = req.body;
    const shift = await Shift.create({
      name,
      startTime,
      endTime,
      tenantId: req.user.tenantId
    });
    res.status(201).json(shift);
  } catch (error) {
    next(error);
  }
};

exports.updateShift = async (req, res, next) => {
  try {
    const shift = await Shift.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    res.json(shift);
  } catch (error) {
    next(error);
  }
};

exports.deleteShift = async (req, res, next) => {
  try {
    const shift = await Shift.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. HOLIDAY MANAGEMENT
// ==========================================

exports.listHolidays = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId || req.employee?.tenantId;
    const holidays = await Holiday.find({ tenantId }).sort({ date: 1 });
    res.json(holidays);
  } catch (error) {
    next(error);
  }
};

exports.createHoliday = async (req, res, next) => {
  try {
    const { name, date, type } = req.body;
    const holiday = await Holiday.create({
      name,
      date,
      type,
      tenantId: req.user.tenantId
    });
    res.status(201).json(holiday);
  } catch (error) {
    next(error);
  }
};

exports.deleteHoliday = async (req, res, next) => {
  try {
    const holiday = await Holiday.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!holiday) return res.status(404).json({ message: 'Holiday not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. ATTENDANCE MODULE
// ==========================================

// Helper to get normalized date (midnight)
const getNormalizedDate = (d = new Date()) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

exports.clockIn = async (req, res, next) => {
  try {
    const employeeId = req.employee._id;
    const tenantId = req.employee.tenantId;
    const today = getNormalizedDate();

    // Check if already clocked in today
    let attendance = await Attendance.findOne({ employeeId, date: today });
    if (attendance && attendance.clockIn) {
      return res.status(400).json({ message: 'Already clocked in for today' });
    }

    // Determine status (Late, Holiday, Weekend)
    let status = 'Present';
    const dayOfWeek = new Date().getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      status = 'Weekend';
    }

    const isHoliday = await Holiday.findOne({ date: today, tenantId });
    if (isHoliday) {
      status = 'Holiday';
    }

    const { latitude, longitude, notes } = req.body;

    if (!attendance) {
      attendance = new Attendance({
        employeeId,
        date: today,
        clockIn: new Date(),
        status,
        latitude,
        longitude,
        notes,
        tenantId
      });
    } else {
      attendance.clockIn = new Date();
      attendance.status = status;
      attendance.latitude = latitude;
      attendance.longitude = longitude;
      attendance.notes = notes;
    }

    await attendance.save();
    res.json({ message: 'Clocked in successfully!', attendance });
  } catch (error) {
    next(error);
  }
};

exports.clockOut = async (req, res, next) => {
  try {
    const employeeId = req.employee._id;
    const today = getNormalizedDate();

    const attendance = await Attendance.findOne({ employeeId, date: today });
    if (!attendance || !attendance.clockIn) {
      return res.status(400).json({ message: 'You have not clocked in today' });
    }

    if (attendance.clockOut) {
      return res.status(400).json({ message: 'Already clocked out for today' });
    }

    attendance.clockOut = new Date();

    // Calculate total hours
    let totalMs = attendance.clockOut - attendance.clockIn;
    
    // Deduct break durations
    let breakMs = 0;
    if (attendance.breaks && attendance.breaks.length > 0) {
      attendance.breaks.forEach(b => {
        if (b.start && b.end) {
          breakMs += (b.end - b.start);
        }
      });
    }
    
    const workingMs = totalMs - breakMs;
    attendance.totalWorkingHours = Math.max(0, workingMs / (1000 * 60 * 60)); // Convert to hours

    await attendance.save();
    res.json({ message: 'Clocked out successfully!', attendance });
  } catch (error) {
    next(error);
  }
};

exports.startBreak = async (req, res, next) => {
  try {
    const employeeId = req.employee._id;
    const today = getNormalizedDate();

    const attendance = await Attendance.findOne({ employeeId, date: today });
    if (!attendance || !attendance.clockIn) {
      return res.status(400).json({ message: 'You must clock in first' });
    }

    // Check if currently on break
    const activeBreak = attendance.breaks.find(b => !b.end);
    if (activeBreak) {
      return res.status(400).json({ message: 'Already on a break' });
    }

    attendance.breaks.push({ start: new Date() });
    await attendance.save();
    res.json({ message: 'Break started', attendance });
  } catch (error) {
    next(error);
  }
};

exports.endBreak = async (req, res, next) => {
  try {
    const employeeId = req.employee._id;
    const today = getNormalizedDate();

    const attendance = await Attendance.findOne({ employeeId, date: today });
    if (!attendance || !attendance.clockIn) {
      return res.status(400).json({ message: 'Attendance record not found' });
    }

    // Find active break
    const activeBreakIndex = attendance.breaks.findIndex(b => !b.end);
    if (activeBreakIndex === -1) {
      return res.status(400).json({ message: 'No active break found' });
    }

    attendance.breaks[activeBreakIndex].end = new Date();
    await attendance.save();
    res.json({ message: 'Break ended', attendance });
  } catch (error) {
    next(error);
  }
};

exports.getMyAttendance = async (req, res, next) => {
  try {
    const employeeId = req.employee._id;
    const history = await Attendance.find({ employeeId }).sort({ date: -1 });
    res.json(history);
  } catch (error) {
    next(error);
  }
};

exports.getAttendanceList = async (req, res, next) => {
  try {
    const filter = { tenantId: req.user.tenantId };
    
    if (req.query.date) {
      filter.date = getNormalizedDate(new Date(req.query.date));
    }
    if (req.query.employeeId) {
      filter.employeeId = req.query.employeeId;
    }

    const list = await Attendance.find(filter)
      .populate('employeeId', 'name email employeeId department role')
      .sort({ date: -1 });
      
    res.json(list);
  } catch (error) {
    next(error);
  }
};

exports.syncGoogleChatAttendance = async (req, res, next) => {
  try {
    const { spaceId } = req.body;
    if (!spaceId) {
      return res.status(400).json({ message: 'Google Chat Space ID is required.' });
    }
    const tenantId = req.user.tenantId;

    const result = await googleChatService.syncAttendanceFromChat(spaceId, tenantId);

    // Persist Google Chat Space ID under Tenant settings
    await Tenant.findByIdAndUpdate(tenantId, {
      $set: { 'settings.googleChatSpaceId': spaceId }
    });

    res.json({
      message: `Google Chat attendance sync completed. Synced ${result.syncCount} actions successfully!`,
      syncCount: result.syncCount,
      logs: result.logs
    });
  } catch (error) {
    next(error);
  }
};

exports.getGoogleChatSpaceId = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const tenant = await Tenant.findById(tenantId);
    res.json({ spaceId: tenant?.settings?.googleChatSpaceId || '' });
  } catch (error) {
    next(error);
  }
};

exports.manualAttendance = async (req, res, next) => {
  try {
    const { employeeId, date, status, clockIn, clockOut, notes } = req.body;
    const normalized = getNormalizedDate(new Date(date));

    let attendance = await Attendance.findOne({ 
      employeeId, 
      date: normalized, 
      tenantId: req.user.tenantId 
    });

    if (attendance) {
      attendance.status = status;
      attendance.clockIn = clockIn ? new Date(clockIn) : undefined;
      attendance.clockOut = clockOut ? new Date(clockOut) : undefined;
      attendance.manualEntry = true;
      attendance.notes = notes;
    } else {
      attendance = new Attendance({
        employeeId,
        date: normalized,
        status,
        clockIn: clockIn ? new Date(clockIn) : undefined,
        clockOut: clockOut ? new Date(clockOut) : undefined,
        manualEntry: true,
        notes,
        tenantId: req.user.tenantId
      });
    }

    if (attendance.clockIn && attendance.clockOut) {
      attendance.totalWorkingHours = Math.max(0, (attendance.clockOut - attendance.clockIn) / (1000 * 60 * 60));
    }

    await attendance.save();
    res.json({ message: 'Attendance logged manually', attendance });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. LEAVE MANAGEMENT
// ==========================================

exports.applyLeave = async (req, res, next) => {
  try {
    const employeeId = req.employee._id;
    const tenantId = req.employee.tenantId;
    const { leaveType, startDate, endDate, reason } = req.body;

    const leaveRequest = await LeaveRequest.create({
      employeeId,
      leaveType,
      startDate,
      endDate,
      reason,
      tenantId
    });

    // Create In-App Notification
    await HrmsNotification.create({
      employeeId,
      type: 'Leave',
      message: `Your leave request for ${leaveType} (${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}) is submitted.`,
      tenantId
    });

    res.status(201).json(leaveRequest);
  } catch (error) {
    next(error);
  }
};

exports.getMyLeaves = async (req, res, next) => {
  try {
    const leaves = await LeaveRequest.find({ employeeId: req.employee._id }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error) {
    next(error);
  }
};

exports.getLeaveBalance = async (req, res, next) => {
  try {
    const tenantId = req.employee?.tenantId || req.user?.tenantId;
    const employeeId = req.employee?._id || req.query.employeeId;

    if (!employeeId) return res.status(400).json({ message: 'Employee ID is required' });

    let balance = await LeaveBalance.findOne({ employeeId, tenantId });
    if (!balance) {
      // Initialize balance
      balance = await LeaveBalance.create({
        employeeId,
        year: new Date().getFullYear(),
        tenantId
      });
    }
    res.json(balance);
  } catch (error) {
    next(error);
  }
};

exports.listLeaves = async (req, res, next) => {
  try {
    const leaves = await LeaveRequest.find({ tenantId: req.user.tenantId })
      .populate('employeeId', 'name email employeeId department role')
      .sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error) {
    next(error);
  }
};

exports.approveLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, approvalStage, approverName } = req.body; // stage: 'manager' or 'hr'

    const leave = await LeaveRequest.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    if (approvalStage === 'manager') {
      leave.managerApproval = { status, approvedBy: approverName, date: new Date() };
      if (status === 'Rejected') {
        leave.status = 'Rejected';
      }
    } else if (approvalStage === 'hr') {
      leave.hrApproval = { status, approvedBy: approverName, date: new Date() };
      if (status === 'Rejected') {
        leave.status = 'Rejected';
      } else if (status === 'Approved' && leave.managerApproval.status === 'Approved') {
        leave.status = 'Approved';

        // Auto deduct leave balance
        const duration = Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1;
        const balance = await LeaveBalance.findOne({ employeeId: leave.employeeId });
        if (balance) {
          const typeKey = leave.leaveType.toLowerCase() === 'work from home' ? 'wfh' : leave.leaveType.toLowerCase();
          if (balance[typeKey]) {
            balance[typeKey].used = (balance[typeKey].used || 0) + duration;
            await balance.save();
          }
        }

        // Auto update Attendance logs to 'Leave' for those dates
        let cur = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        while (cur <= end) {
          const dateNorm = getNormalizedDate(cur);
          await Attendance.findOneAndUpdate(
            { employeeId: leave.employeeId, date: dateNorm, tenantId: req.user.tenantId },
            { status: 'Leave', notes: `Approved Leave: ${leave.leaveType}` },
            { upsert: true, new: true }
          );
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    await leave.save();

    // Notify employee
    await HrmsNotification.create({
      employeeId: leave.employeeId,
      type: 'Leave',
      message: `Your leave request status is updated to: ${leave.status}`,
      tenantId: req.user.tenantId
    });

    res.json({ message: 'Leave status updated successfully', leave });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. PAYROLL MODULE
// ==========================================

exports.listPayroll = async (req, res, next) => {
  try {
    const list = await Payroll.find({ tenantId: req.user.tenantId })
      .populate('employeeId', 'name email employeeId department designation role')
      .sort({ month: -1 });
    res.json(list);
  } catch (error) {
    next(error);
  }
};

exports.generatePayroll = async (req, res, next) => {
  try {
    const { month } = req.body; // "YYYY-MM"
    const tenantId = req.user.tenantId;

    // Get all employees for the tenant
    const employees = await Employee.find({ tenantId, status: 'Active' });
    const generated = [];

    for (const emp of employees) {
      // Check if payroll already exists for this month
      let pay = await Payroll.findOne({ employeeId: emp._id, month, tenantId });
      if (pay) continue;

      // Mathematical splits based on Gross Salary
      const baseSalary = emp.salary || 0;
      const basic = Math.round(baseSalary * 0.50);
      const hra = Math.round(baseSalary * 0.30);
      const allowances = Math.round(baseSalary * 0.20);
      const bonus = 0;
      const overtime = 0;

      // Deductions: Admin requested no automatic deductions (salary is paid in full)
      const pf = 0;
      const esi = 0;
      const pt = 0;
      const tds = 0;

      const gross = basic + hra + allowances + bonus + overtime;
      const net = gross - (pf + esi + pt + tds);

      pay = await Payroll.create({
        employeeId: emp._id,
        month,
        basicSalary: basic,
        hra,
        allowances,
        bonus,
        overtimeEarnings: overtime,
        pfDeduction: pf,
        esiDeduction: esi,
        ptDeduction: pt,
        tdsDeduction: tds,
        grossSalary: gross,
        netSalary: net,
        status: 'Draft',
        tenantId
      });

      generated.push(pay);
    }

    res.status(201).json({ message: `Generated payroll draft for ${generated.length} employees`, payrolls: generated });
  } catch (error) {
    next(error);
  }
};

exports.regeneratePayroll = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { basicSalary, hra, allowances, bonus, overtimeEarnings, pfDeduction, esiDeduction, ptDeduction, tdsDeduction, loanEmiDeduction, otherDeductions } = req.body;

    const pay = await Payroll.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!pay) return res.status(404).json({ message: 'Payroll record not found' });
    if (pay.status === 'Paid') return res.status(400).json({ message: 'Cannot edit an already paid payroll' });

    if (basicSalary !== undefined) pay.basicSalary = basicSalary;
    if (hra !== undefined) pay.hra = hra;
    if (allowances !== undefined) pay.allowances = allowances;
    if (bonus !== undefined) pay.bonus = bonus;
    if (overtimeEarnings !== undefined) pay.overtimeEarnings = overtimeEarnings;
    if (pfDeduction !== undefined) pay.pfDeduction = pfDeduction;
    if (esiDeduction !== undefined) pay.esiDeduction = esiDeduction;
    if (ptDeduction !== undefined) pay.ptDeduction = ptDeduction;
    if (tdsDeduction !== undefined) pay.tdsDeduction = tdsDeduction;
    if (loanEmiDeduction !== undefined) pay.loanEmiDeduction = loanEmiDeduction;
    if (otherDeductions !== undefined) pay.otherDeductions = otherDeductions;

    pay.grossSalary = pay.basicSalary + pay.hra + pay.allowances + pay.bonus + pay.overtimeEarnings;
    pay.netSalary = pay.grossSalary - (pay.pfDeduction + pay.esiDeduction + pay.ptDeduction + pay.tdsDeduction + pay.loanEmiDeduction + pay.otherDeductions);
    pay.status = 'Processed';

    await pay.save();
    res.json(pay);
  } catch (error) {
    next(error);
  }
};

exports.updatePayrollStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const pay = await Payroll.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!pay) return res.status(404).json({ message: 'Payroll record not found' });

    pay.status = status;
    if (status === 'Paid') {
      pay.paymentDate = new Date();
    }

    await pay.save();

    // Create Notification for employee
    if (status === 'Paid' || status === 'Processed') {
      await HrmsNotification.create({
        employeeId: pay.employeeId,
        type: 'Payroll',
        message: `Your payslip for ${pay.month} is generated. Net salary: ₹${pay.netSalary.toLocaleString('en-IN')}`,
        tenantId: req.user.tenantId
      });
    }

    res.json({ message: 'Payroll status updated', payroll: pay });
  } catch (error) {
    next(error);
  }
};

exports.downloadPayslip = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || req.employee?.tenantId;

    const payroll = await Payroll.findOne({ _id: id, tenantId });
    if (!payroll) return res.status(404).json({ message: 'Payroll record not found' });

    const employee = await Employee.findById(payroll.employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const pdfBuffer = await generatePayslipPdf(employee, payroll);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip-${employee.employeeId}-${payroll.month}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 6. DOCUMENT MANAGEMENT
// ==========================================

exports.listAllDocs = async (req, res, next) => {
  try {
    const docs = await Document.find({ tenantId: req.user.tenantId })
      .populate('employeeId', 'name email employeeId department role')
      .sort({ createdAt: -1 });
    res.json(docs);
  } catch (error) {
    next(error);
  }
};

exports.getMyDocs = async (req, res, next) => {
  try {
    const docs = await Document.find({ employeeId: req.employee._id }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (error) {
    next(error);
  }
};

exports.uploadDoc = async (req, res, next) => {
  try {
    const { name, type, fileUrl } = req.body;
    const employeeId = req.employee?._id || req.body.employeeId;
    const tenantId = req.user?.tenantId || req.employee?.tenantId;

    if (!employeeId) return res.status(400).json({ message: 'Employee ID is required' });

    const doc = await Document.create({
      employeeId,
      name,
      type,
      fileUrl,
      tenantId
    });

    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
};

exports.getHrPolicy = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId || req.employee?.tenantId;
    const policyDoc = await Document.findOne({
      tenantId,
      name: { $regex: /^Corporate HR Policy$/i }
    }).sort({ createdAt: -1 });

    if (!policyDoc) {
      return res.status(404).json({ message: 'HR Policy document not found' });
    }
    res.json(policyDoc);
  } catch (error) {
    next(error);
  }
};

exports.uploadHrPolicy = async (req, res, next) => {
  try {
    const employeeId = req.employee?._id || null;
    const tenantId = req.employee?.tenantId || req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.employee) {
      const isAuthorized = req.employee.role === 'HR' || 
                           req.employee.role === 'ADMIN' || 
                           req.employee.role === 'Super Admin' ||
                           (req.employee.designation && req.employee.designation.toUpperCase().includes('HR'));
      if (!isAuthorized) {
        return res.status(403).json({ message: 'Only HR or Admin staff can upload HR policies.' });
      }
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded or file is not a PDF.' });
    }

    const bucketName = process.env.AWS_BUCKET_NAME;
    const region = process.env.AWS_REGION;

    if (!bucketName || !region || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return res.status(500).json({ message: 'AWS S3 environment variables are not fully configured.' });
    }

    const ext = path.extname(req.file.originalname) || '.pdf';
    const safeName = `policy_${Date.now()}${ext}`;
    const keyName = `hr-policies/${tenantId}/${safeName}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: keyName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3Client.send(command);

    const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${keyName}`;

    const docData = {
      name: 'Corporate HR Policy',
      type: 'Other',
      fileUrl,
      tenantId
    };
    if (employeeId) {
      docData.employeeId = employeeId;
    }

    // Delete existing Corporate HR Policy documents for this tenant
    await Document.deleteMany({
      tenantId,
      name: { $regex: /^Corporate HR Policy$/i }
    });

    const doc = await Document.create(docData);

    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 7. DASHBOARD METRICS
// ==========================================

exports.getAdminDashboardStats = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const today = getNormalizedDate();

    const totalEmployees = await Employee.countDocuments({ tenantId, status: 'Active' });
    const presentToday = await Attendance.countDocuments({ tenantId, date: today, status: 'Present' });
    const absentToday = await Attendance.countDocuments({ tenantId, date: today, status: 'Absent' });
    const onLeaveToday = await Attendance.countDocuments({ tenantId, date: today, status: 'Leave' });
    const pendingLeaves = await LeaveRequest.countDocuments({ tenantId, status: 'Pending' });
    
    // Financials
    const payrollPaid = await Payroll.aggregate([
      { $match: { tenantId, status: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$netSalary' } } }
    ]);

    res.json({
      totalEmployees,
      presentToday,
      absentToday,
      onLeaveToday,
      pendingLeaves,
      totalPayrollCost: payrollPaid[0]?.total || 0
    });
  } catch (error) {
    next(error);
  }
};

exports.getEmployeeDashboardStats = async (req, res, next) => {
  try {
    const employeeId = req.employee._id;
    const tenantId = req.employee.tenantId;
    const today = getNormalizedDate();

    const todayAttendance = await Attendance.findOne({ employeeId, date: today });
    const leaveBalance = await LeaveBalance.findOne({ employeeId, tenantId });
    const recentPayslips = await Payroll.find({ employeeId, status: 'Paid' })
      .sort({ month: -1 })
      .limit(5);

    res.json({
      todayAttendance,
      leaveBalance: leaveBalance || { casual: { allocated: 12, used: 0 }, sick: { allocated: 10, used: 0 } },
      recentPayslips
    });
  } catch (error) {
    next(error);
  }
};
