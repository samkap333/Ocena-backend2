function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.length || roles.includes(req.user?.role)) {
      return next();
    }

    return res.status(403).json({ message: 'Insufficient permissions' });
  };
}

module.exports = { requireRoles };
