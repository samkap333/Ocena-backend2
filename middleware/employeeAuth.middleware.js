const jwt = require('jsonwebtoken');
const { Employee } = require('../models/crm');

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required');
  }
  return 'ocena-local-dev-jwt-secret';
}

async function employeeAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Employee authentication required' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const employee = await Employee.findById(decoded.id);

    if (!employee) {
      return res.status(401).json({ message: 'Employee profile not found' });
    }

    if (employee.status === 'Inactive' || employee.status === 'Suspended' || employee.status === 'Terminated') {
      return res.status(403).json({ message: 'Employee account is suspended, inactive, or terminated' });
    }

    req.employee = employee;
    req.tenantId = employee.tenantId; // Set tenant context
    return next();
  } catch (error) {
    console.error('[Employee Auth Debug] Verification error:', error.message);
    return res.status(401).json({ message: 'Invalid or expired employee token' });
  }
}

module.exports = employeeAuth;
