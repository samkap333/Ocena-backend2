const jwt = require('jsonwebtoken');

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required');
  }

  return 'ocena-local-dev-jwt-secret';
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(token, getJwtSecret());
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
