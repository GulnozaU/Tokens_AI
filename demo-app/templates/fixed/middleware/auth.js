/**
 * Auth middleware — FIXED VERSION (returns clear error for expired tokens).
 */
const jwt = require('../utils/jwt');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  try {
    const token = header.slice('Bearer '.length);
    req.user = jwt.verify(token);
    next();
  } catch (err) {
    const message = err.message === 'Token expired' ? 'Token expired' : 'Unauthorized';
    return res.status(401).json({ error: message });
  }
}

module.exports = { authMiddleware };
