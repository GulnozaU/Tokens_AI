/**
 * Auth middleware — BUGGY VERSION (trusts jwt.verify without expiry handling).
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
    return res.status(401).json({ error: err.message || 'Unauthorized' });
  }
}

module.exports = { authMiddleware };
