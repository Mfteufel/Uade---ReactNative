process.env.JWT_SECRET = 'x'.repeat(48);
process.env.PUBLIC_URL = 'http://test.local:3000';
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeReputation } = require('../src/services/reputation');
const { toPublicProfile } = require('../src/services/publicProfile');

const c = (returns, positive, negative) => computeReputation({ returns, positive, negative });

test('casos del seed', () => {
  assert.deepEqual(c(12, 18, 1), { points: 151, completedReturns: 12, positiveRatings: 18, negativeRatings: 1, positivePercent: 95 });
  assert.deepEqual(c(5, 6, 0), { points: 62, completedReturns: 5, positiveRatings: 6, negativeRatings: 0, positivePercent: 100 });
  assert.deepEqual(c(2, 1, 3), { points: 7, completedReturns: 2, positiveRatings: 1, negativeRatings: 3, positivePercent: 25 });
  assert.deepEqual(c(0, 0, 0), { points: 0, completedReturns: 0, positiveRatings: 0, negativeRatings: 0, positivePercent: null });
});

test('mínimo 0 puntos', () => {
  const r = c(0, 0, 3);
  assert.equal(r.points, 0);
  assert.equal(r.positivePercent, 0);
});

test('redondeo del porcentaje', () => {
  assert.equal(c(0, 1, 2).positivePercent, 33);
  assert.equal(c(0, 2, 1).positivePercent, 67);
  // 29/200 = 14,5 %: con (pos/total)*100 daba 14 por punto flotante
  assert.equal(c(0, 29, 171).positivePercent, 15);
  assert.equal(c(0, 57, 143).positivePercent, 29);
});

test('toPublicProfile devuelve exactamente la lista blanca', () => {
  const rep = c(0, 0, 0);
  const row = {
    id: 'u_x', name: 'X', created_at: '2024-03-10T12:00:00.000Z',
    email: 'x@y.com', phone: '1', neighborhood: 'n', password_hash: 'h', phone_visible_on_claim: true, photo_id: 'p',
  };
  const out = toPublicProfile(row, rep);
  assert.deepEqual(Object.keys(out).sort(), ['id', 'memberSince', 'name', 'photoUri', 'reputation']);
  assert.equal(out.memberSince, '2024-03-10T12:00:00.000Z');
  assert.equal(out.photoUri, 'http://test.local:3000/photos/p');
  assert.equal(out.reputation, rep);
  const out2 = toPublicProfile({ ...row, photo_id: null }, rep);
  assert.equal(out2.photoUri, null);
  assert.deepEqual(Object.keys(out2).sort(), ['id', 'memberSince', 'name', 'photoUri', 'reputation']);
});
