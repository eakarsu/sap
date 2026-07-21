module.exports = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(String(req.user.role).toLowerCase())) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};
