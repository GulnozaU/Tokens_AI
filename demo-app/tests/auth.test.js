const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('../src/utils/jwt');
const { authMiddleware } = require('../src/middleware/auth');

test('expired JWT must be rejected by jwt.verify', () => {
  const token = jwt.sign({ userId: 1 }, { expiresInSec: -10 });
  assert.throws(() => jwt.verify(token), /expired/i);
});

test('valid JWT is accepted', () => {
  const token = jwt.sign({ userId: 1 }, { expiresInSec: 3600 });
  const payload = jwt.verify(token);
  assert.equal(payload.userId, 1);
});

test('auth middleware rejects expired bearer token', () => {
  const token = jwt.sign({ userId: 1 }, { expiresInSec: -10 });
  const req = { headers: { authorization: `Bearer ${token}` } };
  let status = 200;
  let body = null;
  const res = {
    status(code) { status = code; return this; },
    json(data) { body = data; },
  };
  let called = false;
  authMiddleware(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(status, 401);
  assert.match(body.error, /expired/i);
});
