function tenantMiddleware(req, res, next) {
  req.tenantId = req.user?.tenantId || req.headers['x-tenant-id'];

  if (!req.tenantId) {
    return res.status(400).json({ message: 'Tenant context is required' });
  }

  return next();
}

module.exports = tenantMiddleware;
