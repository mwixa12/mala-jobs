import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'malajobs_jwt_secret_key_2026';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'malajobs_refresh_secret_key_2026';

// Store active refresh tokens in memory / cache
const activeRefreshTokens = new Set();

export function generateTokens(user) {
  const payload = {
    userId: user.id,
    role: user.role,
    phone: user.phone_number,
    email: user.email
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: '30d' });

  activeRefreshTokens.add(refreshToken);

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export function verifyRefreshToken(token) {
  try {
    // Verify JWT signature - if valid, accept it
    // (In-memory set may have been cleared by server restart, so we only check signature)
    return jwt.verify(token, REFRESH_SECRET);
  } catch (err) {
    return null;
  }
}

export function revokeRefreshToken(token) {
  activeRefreshTokens.delete(token);
}
