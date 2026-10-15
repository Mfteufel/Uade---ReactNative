process.env.JWT_SECRET = 'x'.repeat(48);
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const t = require('../src/services/tokens');

const S = process.env.JWT_SECRET;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

test('access token ok', () => {
  assert.deepEqual(t.verifyAccessToken(t.signAccessToken('u_1')), { userId: 'u_1' });
});

test('registration y access no se cruzan', () => {
  const reg = t.signRegistrationToken('a@b.com');
  const acc = t.signAccessToken('u_1');
  assert.throws(() => t.verifyAccessToken(reg), { status: 401 });
  assert.throws(() => t.verifyRegistrationToken(acc), { status: 401, message: 'El registro venció. Empezá de nuevo.' });
  assert.deepEqual(t.verifyRegistrationToken(reg), { email: 'a@b.com' });
});

test('verifyAccessToken rechaza tokens mal formados', () => {
  const bad = [
    jwt.sign({ purpose: 'access' }, S, { algorithm: 'HS256', subject: 'u_1' }),
    jwt.sign({ purpose: 'register' }, S, { algorithm: 'HS256', subject: 'u_1', audience: 'access' }),
    jwt.sign({ purpose: 'access', sub: 123 }, S, { algorithm: 'HS256', audience: 'access' }),
    jwt.sign({ purpose: 'access' }, S, { algorithm: 'HS512', subject: 'u_1', audience: 'access' }),
    `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ purpose: 'access', sub: 'u_1', aud: 'access' })}.`,
    jwt.sign({ purpose: 'access' }, 'y'.repeat(48), { algorithm: 'HS256', subject: 'u_1', audience: 'access' }),
    jwt.sign({ purpose: 'access' }, S, { algorithm: 'HS256', subject: 'u_1', audience: 'access', expiresIn: -10 }),
    42,
    undefined,
  ];
  for (const x of bad) {
    assert.throws(() => t.verifyAccessToken(x), { status: 401, message: 'Sesión inválida. Volvé a iniciar sesión.' });
  }
});

test('hashRefreshToken determinista, 64 hex', () => {
  const h = t.hashRefreshToken('abc');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, t.hashRefreshToken('abc'));
  assert.notEqual(h, t.hashRefreshToken('abd'));
});

test('REFRESH_RE', () => {
  assert.ok(t.REFRESH_RE.test(crypto.randomBytes(32).toString('base64url')));
  assert.ok(!t.REFRESH_RE.test(''));
  assert.ok(!t.REFRESH_RE.test('a'.repeat(42)));
  assert.ok(!t.REFRESH_RE.test('a'.repeat(44)));
  assert.ok(!t.REFRESH_RE.test('a'.repeat(40) + '+/='));
});
