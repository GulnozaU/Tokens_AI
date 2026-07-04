/**
 * JWT helpers — FIXED VERSION (rejects expired tokens).
 */
const crypto = require('crypto');

const DEFAULT_SECRET = 'demo-secret-change-in-production';

function base64url(data) {
  return Buffer.from(data).toString('base64url');
}

function sign(payload, options = {}) {
  const secret = options.secret || process.env.JWT_SECRET || DEFAULT_SECRET;
  const expiresInSec = options.expiresInSec ?? 3600;
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSec,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const sig = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

function verify(token, options = {}) {
  const secret = options.secret || process.env.JWT_SECRET || DEFAULT_SECRET;
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }
  const [headerB64, bodyB64, sig] = parts;
  const unsigned = `${headerB64}.${bodyB64}`;
  const expected = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  if (sig !== expected) {
    throw new Error('Invalid signature');
  }
  const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  return payload;
}

module.exports = { sign, verify };
