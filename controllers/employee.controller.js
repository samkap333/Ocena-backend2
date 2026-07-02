const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Employee } = require('../models/crm');
const emailService = require('../services/email.service');

function signEmployeeToken(employee) {
  return jwt.sign(
    { id: employee._id, email: employee.email, role: employee.role, tenantId: employee.tenantId },
    process.env.JWT_SECRET || 'ocena-local-dev-jwt-secret',
    { expiresIn: '15d' }
  );
}

// Get all employees for the admin's tenant
exports.list = async (req, res, next) => {
  try {
    const employees = await Employee.find({ tenantId: req.user.tenantId }).sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    next(error);
  }
};

// Create a new employee invite (pending activation)
exports.create = async (req, res, next) => {
  try {
    const { name, email, role, department, salary, employeeId, joiningDate, bankName, accountNumber, ifscCode, branchName, paymentMode, paymentType, upiId, googleChatUserId } = req.body;
    
    // Check for existing employee
    const existing = await Employee.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Employee with this email already exists.' });
    }
    
    // Check for existing employee ID
    const existingId = await Employee.findOne({ employeeId });
    if (existingId) {
      return res.status(400).json({ message: 'Employee ID already in use.' });
    }

    const employee = await Employee.create({
      name,
      email: email.toLowerCase(),
      role,
      department,
      salary,
      employeeId,
      joiningDate: joiningDate || undefined,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      paymentMode: paymentMode || 'Bank Transfer',
      paymentType: paymentType || 'Paid',
      upiId,
      googleChatUserId,
      pendingInvite: true,
      tenantId: req.user.tenantId
    });

    res.status(201).json(employee);
  } catch (error) {
    next(error);
  }
};

// Update employee details (admin only)
exports.update = async (req, res, next) => {
  try {
    const { email } = req.params;
    const employee = await Employee.findOneAndUpdate(
      { email: email.toLowerCase(), tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    res.json(employee);
  } catch (error) {
    next(error);
  }
};

// Delete an employee record (admin only)
exports.remove = async (req, res, next) => {
  try {
    const { email } = req.params;
    const employee = await Employee.findOneAndDelete({ 
      email: email.toLowerCase(), 
      tenantId: req.user.tenantId 
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Activate account via invitation link
exports.activate = async (req, res, next) => {
  try {
    const { email, password, name, role, department, salary } = req.body;
    const employee = await Employee.findOne({ email: email.toLowerCase() });
    
    if (!employee) {
      return res.status(404).json({ message: 'No invitation record found for this email.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    employee.password = hashedPassword;
    employee.pendingInvite = false;
    
    if (name) employee.name = name;
    if (role) employee.role = role;
    if (department) employee.department = department;
    if (salary) employee.salary = salary;

    await employee.save();
    
    const token = signEmployeeToken(employee);

    res.json({ 
      message: 'Account activated successfully!', 
      token,
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        salary: employee.salary,
        employeeId: employee.employeeId,
        joiningDate: employee.joiningDate,
        bankName: employee.bankName,
        accountNumber: employee.accountNumber,
        ifscCode: employee.ifscCode,
        branchName: employee.branchName,
        panNumber: employee.panNumber,
        paymentMode: employee.paymentMode,
        upiId: employee.upiId
      }
    });
  } catch (error) {
    next(error);
  }
};

// Employee portal login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const employee = await Employee.findOne({ email: email.toLowerCase() });

    if (!employee) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (employee.pendingInvite) {
      return res.status(400).json({ message: 'Your account invitation is pending activation. Please register using the invitation link.' });
    }

    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = signEmployeeToken(employee);

    res.json({
      message: 'Login successful',
      token,
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        salary: employee.salary,
        employeeId: employee.employeeId,
        joiningDate: employee.joiningDate,
        bankName: employee.bankName,
        accountNumber: employee.accountNumber,
        ifscCode: employee.ifscCode,
        branchName: employee.branchName,
        panNumber: employee.panNumber,
        paymentMode: employee.paymentMode,
        upiId: employee.upiId
      }
    });
  } catch (error) {
    next(error);
  }
};

// Employee self-update PAN
exports.updatePan = async (req, res, next) => {
  try {
    const { email, panNumber } = req.body;
    const employee = await Employee.findOneAndUpdate(
      { email: email.toLowerCase() },
      { panNumber },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    res.json({
      message: 'PAN details updated successfully!',
      employee: {
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        salary: employee.salary,
        employeeId: employee.employeeId,
        joiningDate: employee.joiningDate,
        bankName: employee.bankName,
        accountNumber: employee.accountNumber,
        ifscCode: employee.ifscCode,
        branchName: employee.branchName,
        panNumber: employee.panNumber,
        paymentMode: employee.paymentMode,
        upiId: employee.upiId
      }
    });
  } catch (error) {
    next(error);
  }
};

// Request password reset OTP
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const employee = await Employee.findOne({ email: email.toLowerCase() });
    if (!employee) {
      return res.status(404).json({ message: 'No employee account found with this email.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    employee.resetOtp = otp;
    employee.resetOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await employee.save();

    // Try sending email
    try {
      await emailService.sendEmail({
        to: employee.email,
        subject: 'Password Reset OTP - Ocena Smart Solutions',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #3b82f6; text-align: center;">Password Reset Request</h2>
            <p>Dear ${employee.name},</p>
            <p>You requested to reset your password. Use the following One-Time Password (OTP) to proceed:</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="font-size: 28px; font-weight: bold; letter-spacing: 4px; padding: 10px 20px; background-color: #f1f5f9; border-radius: 6px; border: 1px dashed #cbd5e1; display: inline-block;">
                ${otp}
              </span>
            </div>
            <p style="color: #64748b; font-size: 13px;">This OTP is valid for 10 minutes. If you did not request a password reset, please ignore this email.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">OCENA Smart Solutions</p>
          </div>
        `
      });
      res.json({ message: 'OTP sent to your email.' });
    } catch (mailErr) {
      console.warn('⚠️ Mail delivery failed, falling back to JSON response for dev/test: ', mailErr.message);
      res.json({ 
        message: 'OTP generated. (Dev Fallback: your OTP is ' + otp + ')',
        testOtp: otp
      });
    }
  } catch (error) {
    next(error);
  }
};

// Reset password using OTP
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required.' });
    }

    const employee = await Employee.findOne({ email: email.toLowerCase() });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    if (!employee.resetOtp || employee.resetOtp !== otp || employee.resetOtpExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    // Hash and set new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    employee.password = hashedPassword;
    
    // Clear OTP fields
    employee.resetOtp = undefined;
    employee.resetOtpExpires = undefined;
    
    await employee.save();

    res.json({ message: 'Password reset successfully! You can now log in.' });
  } catch (error) {
    next(error);
  }
};

// Get logged-in employee self profile
exports.getProfile = async (req, res, next) => {
  try {
    res.json(req.employee);
  } catch (error) {
    next(error);
  }
};

// Self update profile (employee portal)
exports.updateProfile = async (req, res, next) => {
  try {
    const allowedUpdates = [
      'phone', 'address', 'emergencyContactName', 'emergencyContactPhone',
      'bankName', 'accountNumber', 'ifscCode', 'branchName', 'upiId', 'panNumber'
    ];
    
    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const employee = await Employee.findByIdAndUpdate(
      req.employee._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Profile updated successfully!',
      employee
    });
  } catch (error) {
    next(error);
  }
};

// Send invitation email to employee
exports.sendInvite = async (req, res, next) => {
  try {
    const { email, inviteUrl } = req.body;
    if (!email || !inviteUrl) {
      return res.status(400).json({ message: 'Email and inviteUrl are required.' });
    }

    const employee = await Employee.findOne({ email: email.toLowerCase(), tenantId: req.user.tenantId });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    try {
      await emailService.sendEmail({
        to: employee.email,
        subject: 'Invitation to Join Employee Portal - Ocena Smart Solutions',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #3b82f6; text-align: center;">Welcome to Ocena Smart Solutions</h2>
            <p>Dear ${employee.name},</p>
            <p>You have been onboarded as a <strong>${employee.role}</strong> in the <strong>${employee.department || 'Staff'}</strong> department.</p>
            <p>To register your account, view your salary details, payslips, and manage your attendance, please click the button below to activate your account:</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; font-weight: bold; text-decoration: none; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.5);">
                Activate Employee Account
              </a>
            </div>
            <p style="color: #64748b; font-size: 13px;">If you have trouble clicking the button, copy and paste the link below into your web browser:</p>
            <p style="color: #3b82f6; font-size: 12px; word-break: break-all;">${inviteUrl}</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">OCENA Smart Solutions</p>
          </div>
        `
      });
      res.json({ message: 'Invitation email sent successfully!' });
    } catch (mailErr) {
      console.warn('⚠️ Mail delivery failed, falling back: ', mailErr.message);
      res.status(500).json({ 
        message: 'Could not send invitation email. Please copy the link instead.',
        error: mailErr.message
      });
    }
  } catch (error) {
    next(error);
  }
};

