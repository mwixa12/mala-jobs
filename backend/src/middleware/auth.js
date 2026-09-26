import { verifyAccessToken } from '../utils/tokens.js';
import { query } from '../config/db.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired access token' });
  }

  try {
    const userRes = await query('SELECT id, phone_number, email, role, preferred_language, is_active FROM users WHERE id = $1', [decoded.userId]);
    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      return res.status(403).json({ error: 'User account not active or not found' });
    }

    req.user = userRes.rows[0];
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to authenticate user' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}
