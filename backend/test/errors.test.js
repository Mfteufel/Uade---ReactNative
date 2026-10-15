const test = require('node:test');
const assert = require('node:assert/strict');
const { HttpError, errorHandler, isDbUnavailable } = require('../src/middleware/errors');

const fakeRes = () => {
  const r = { headers: {}, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; }, set(k, v) { r.headers[k] = v; return r; } };
  return r;
};

test('isDbUnavailable reconoce errores de red hacia la base', () => {
  for (const code of ['EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']) {
    assert.equal(isDbUnavailable({ code }), true, code);
  }
  assert.equal(isDbUnavailable(new Error('timeout exceeded when trying to connect')), true);
  assert.equal(isDbUnavailable(new Error('Connection terminated unexpectedly')), true);
  assert.equal(isDbUnavailable(new Error('otro error')), false);
  assert.equal(isDbUnavailable({ code: '23505' }), false);
  assert.equal(isDbUnavailable(null), false);
});

test('errorHandler responde 503 claro (con Retry-After) si la base no está disponible', () => {
  const res = fakeRes();
  const orig = console.error; console.error = () => {};
  try { errorHandler(Object.assign(new Error('x'), { code: 'EAI_AGAIN', hostname: 'secreto.neon.tech' }), {}, res, () => {}); } finally { console.error = orig; }
  assert.equal(res.code, 503);
  assert.equal(res.headers['Retry-After'], '5');
  assert.deepEqual(Object.keys(res.body), ['message']);
  assert.ok(!JSON.stringify(res.body).includes('neon'));
});

test('errorHandler sigue dando 500 para errores desconocidos y respeta HttpError', () => {
  const orig = console.error; console.error = () => {};
  const a = fakeRes();
  try { errorHandler(new Error('bug'), {}, a, () => {}); } finally { console.error = orig; }
  assert.equal(a.code, 500);
  const b = fakeRes();
  errorHandler(new HttpError(422, 'msg'), {}, b, () => {});
  assert.equal(b.code, 422);
});
