export function requireSuperadmin(req, res, next) {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'superadmin') return res.status(403).json({ error: 'Solo superadmin' });
    next();
  } catch {
    return res.status(401).json({ error: 'No autenticado' });
  }
}
