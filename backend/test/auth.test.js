process.env.JWT_SECRET = 'x'.repeat(48);
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { parseBearer, requireAuth } = require('../src/middleware/auth');
const { signAccessToken, signRegistrationToken, DUMMY_HASH, BCRYPT_COST } = require('../src/services/tokens');

test('parseBearer', () => {
  const tok = signAccessToken('u_1');
  assert.equal(parseBearer(`Bearer ${tok}`), tok);
  assert.equal(parseBearer(`bearer ${tok}`), tok);
  assert.equal(parseBearer('Bearer '), null);
  assert.equal(parseBearer('Basic x'), null);
  assert.equal(parseBearer(`Bearer  ${tok}`), null);
  assert.equal(parseBearer('Bearer abc'), null);
  assert.equal(parseBearer(undefined), null);
});

function run(header) {
  let err;
  const req = { headers: header === undefined ? {} : { authorization: header } };
  requireAuth(req, {}, (e) => { err = e; });
  return { req, err };
}

test('requireAuth', () => {
  const ok = run(`Bearer ${signAccessToken('u_9')}`);
  assert.equal(ok.err, undefined);
  assert.deepEqual(ok.req.user, { id: 'u_9' });
  for (const h of [undefined, 'Bearer x', `Bearer ${signRegistrationToken('a@b.com')}`]) {
    const r = run(h);
    assert.equal(r.err.status, 401);
    assert.equal(r.err.message, 'Sesión inválida. Volvé a iniciar sesión.');
    assert.equal(r.req.user, undefined);
  }
});

test('DUMMY_HASH usa el cost de bcrypt', () => {
  assert.equal(bcrypt.getRounds(DUMMY_HASH), BCRYPT_COST);
});
