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

    if (!employee || employee.status === 'Inactive' || employee.status === 'Suspended') {
      return res.status(403).json({ message: 'Employee account is suspended or inactive' });
    }

    req.employee = employee;
    req.tenantId = employee.tenantId; // Set tenant context
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired employee token' });
  }
}

module.exports = employeeAuth;
