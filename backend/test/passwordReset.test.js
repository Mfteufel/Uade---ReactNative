process.env.JWT_SECRET = 'x'.repeat(48);
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertNewPassword } = require('../src/services/passwordRules');

const fails = (v, status, re) =>
  assert.throws(() => assertNewPassword(v), (e) => e.status === status && re.test(e.message));

test('assertNewPassword', () => {
  fails('a'.repeat(7), 422, /8 caracteres/);
  assert.doesNotThrow(() => assertNewPassword('a'.repeat(8)));
  assert.doesNotThrow(() => assertNewPassword('a'.repeat(72)));
  fails('a'.repeat(73), 422, /72 caracteres/);
  assert.doesNotThrow(() => assertNewPassword('ñ'.repeat(36)));
  fails('ñ'.repeat(37), 422, /72 caracteres/);
  fails(12345678, 422, /8 caracteres/);
  fails(undefined, 422, /8 caracteres/);
});
