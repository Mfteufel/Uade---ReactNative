const test = require('node:test');
const assert = require('node:assert/strict');
const o = require('../src/services/otp');

test('generateCode da 6 dígitos y a veces con cero adelante', () => {
  let leading = false;
  for (let i = 0; i < 1000; i++) {
    const c = o.generateCode();
    assert.match(c, /^\d{6}$/);
    if (c[0] === '0') leading = true;
  }
  assert.ok(leading);
});

test('cooldownRemaining', () => {
  assert.equal(o.cooldownRemaining(0), 60);
  assert.equal(o.cooldownRemaining(59.2), 1);
  assert.equal(o.cooldownRemaining(60), 0);
});

test('evaluateAttempt', () => {
  assert.deepEqual(o.evaluateAttempt({ expired: true, matches: true, attempts: 0 }), { outcome: 'expired' });
  for (let a = 0; a <= 3; a++) {
    assert.deepEqual(o.evaluateAttempt({ expired: false, matches: false, attempts: a }), {
      outcome: 'wrong', attempts: a + 1, left: 4 - a,
    });
  }
  assert.deepEqual(o.evaluateAttempt({ expired: false, matches: false, attempts: 4 }), { outcome: 'locked', attempts: 5 });
  assert.deepEqual(o.evaluateAttempt({ expired: false, matches: true, attempts: 2 }), { outcome: 'ok' });
});

test('wrongCodeMessage', () => {
  assert.equal(o.wrongCodeMessage(1), 'Código incorrecto. Te queda 1 intento.');
  assert.equal(o.wrongCodeMessage(3), 'Código incorrecto. Te quedan 3 intentos.');
});

test('hashCode / compareCode', async () => {
  const h = await o.hashCode('123456');
  assert.equal(await o.compareCode('123456', h), true);
  assert.equal(await o.compareCode('654321', h), false);
});

test('email', () => {
  assert.equal(o.normalizeEmail(' A@B.co '), 'a@b.co');
  assert.equal(o.normalizeEmail(5), '');
  assert.equal(o.isValidEmail('a@b'), false);
  assert.equal(o.isValidEmail('a@b.co'), true);
});

test('isValidEmail rechaza rápido un email patológico largo', () => {
  const t = process.hrtime.bigint();
  const r = o.isValidEmail('a@' + 'a.'.repeat(5000) + '@');
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  assert.equal(r, false);
  assert.ok(ms < 20, `tardó ${ms} ms`);
});

test('isValidEmail rechaza 255 caracteres y acepta 254', () => {
  assert.equal(o.isValidEmail('a'.repeat(243) + '@example.com'), false);
  assert.equal(o.isValidEmail('a'.repeat(242) + '@example.com'), true);
});

test('outcomeError mapea cada resultado', () => {
  const e = (r) => o.outcomeError(r);
  assert.deepEqual([e({ none: true }).status, e({ none: true }).message], [400, 'Pedí un código primero.']);
  assert.deepEqual([e({ outcome: 'expired' }).status, e({ outcome: 'expired' }).message], [410, 'El código venció. Pedí uno nuevo.']);
  const w = e({ outcome: 'wrong', left: 4 });
  assert.deepEqual([w.status, w.message], [400, 'Código incorrecto. Te quedan 4 intentos.']);
  assert.equal(e({ outcome: 'wrong', left: 1 }).message, 'Código incorrecto. Te queda 1 intento.');
  const l = e({ outcome: 'locked', attempts: 5 });
  assert.deepEqual([l.status, l.message], [429, 'Demasiados intentos fallidos. Pedí un código nuevo.']);
  assert.equal(e({ outcome: 'ok' }), null);
});
