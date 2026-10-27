process.env.JWT_SECRET = 'x'.repeat(48);
process.env.PUBLIC_URL = 'http://test.local:3000';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  claimTypeFor,
  normalizeAnswer,
  answersMatch,
  buildClaimInput,
  claimBlock,
  toClaimView,
} = require('../src/services/claims');

const PHOTO = '3f2c1a9e-0b7d-4c1e-9a8f-2d6b5e7c8a90';

test('el tipo de reclamo sale del tipo de publicación', () => {
  assert.equal(claimTypeFor('found'), 'mine');
  assert.equal(claimTypeFor('lost'), 'found');
});

test('la respuesta se compara sin mayúsculas, acentos ni espacios de más', () => {
  assert.equal(normalizeAnswer('  Azúl   CLARO '), 'azul claro');
  assert.ok(answersMatch('azul claro', 'Azúl Claro'));
  assert.ok(!answersMatch('rojo', 'azul'));
  assert.ok(!answersMatch('', ''));
  assert.ok(!answersMatch(null, 'azul'));
});

test('"Es mío": exige respuesta; descripción y foto son opcionales', () => {
  assert.equal(buildClaimInput('found', {}).error.status, 422);
  assert.equal(buildClaimInput('found', { verificationAnswer: '   ' }).error.status, 422);
  const ok = buildClaimInput('found', { verificationAnswer: ' Rojo ' });
  assert.deepEqual(ok.input, {
    type: 'mine',
    verificationAnswer: 'Rojo',
    description: null,
    photoId: null,
    foundNeighborhoodId: null,
  });
  const full = buildClaimInput('found', { verificationAnswer: 'Rojo', description: 'Tiene un sticker', photoId: PHOTO.toUpperCase() });
  assert.equal(full.input.description, 'Tiene un sticker');
  assert.equal(full.input.photoId, PHOTO);
});

test('"Es mío": rechaza foto mal formada, texto largo y caracteres de control', () => {
  assert.ok(buildClaimInput('found', { verificationAnswer: 'x', photoId: 'no-es-uuid' }).error);
  assert.ok(buildClaimInput('found', { verificationAnswer: 'x'.repeat(201) }).error);
  assert.ok(buildClaimInput('found', { verificationAnswer: 'x', description: 'y'.repeat(281) }).error);
  assert.ok(buildClaimInput('found', { verificationAnswer: 'a\u0000b' }).error);
  assert.ok(buildClaimInput('found', { verificationAnswer: 123 }).error);
});

test('"Lo encontré": exige foto y barrio, y no usa la pregunta de verificación', () => {
  assert.equal(buildClaimInput('lost', {}).error.status, 422);
  assert.equal(buildClaimInput('lost', { photoId: PHOTO }).error.status, 422);
  assert.equal(buildClaimInput('lost', { foundNeighborhoodId: 'palermo' }).error.status, 422);
  const ok = buildClaimInput('lost', { photoId: PHOTO, foundNeighborhoodId: 'palermo', verificationAnswer: 'ignorada' });
  assert.deepEqual(ok.input, {
    type: 'found',
    verificationAnswer: null,
    description: null,
    photoId: PHOTO,
    foundNeighborhoodId: 'palermo',
  });
});

test('el body tiene que ser un objeto', () => {
  assert.equal(buildClaimInput('found', []).error.status, 422);
  assert.equal(buildClaimInput('found', 'hola').error.status, 422);
  assert.equal(buildClaimInput('found', undefined).error.status, 422); // sin respuesta
});

test('quién no puede reclamar y por qué', () => {
  const pub = { user_id: 'u_dueño', status: 'open', vencida: false };
  const none = { used: 0, active: false };
  assert.equal(claimBlock({ pub, userId: 'u_otro', attempts: none }), null);
  assert.equal(claimBlock({ pub, userId: 'u_dueño', attempts: none }).status, 403);
  assert.equal(claimBlock({ pub: { ...pub, status: 'in_claim' }, userId: 'u_otro', attempts: none }).status, 409);
  assert.equal(claimBlock({ pub: { ...pub, status: 'resolved' }, userId: 'u_otro', attempts: none }).status, 409);
  assert.equal(claimBlock({ pub: { ...pub, vencida: true }, userId: 'u_otro', attempts: none }).status, 409);
  assert.equal(claimBlock({ pub, userId: 'u_otro', attempts: { used: 1, active: true } }).status, 409);
  // 3 intentos usados (aunque estén rechazados o vencidos) => no hay un cuarto
  const agotado = claimBlock({ pub, userId: 'u_otro', attempts: { used: 3, active: false } });
  assert.equal(agotado.status, 403);
  assert.match(agotado.message, /3 intentos/);
  assert.equal(claimBlock({ pub, userId: 'u_otro', attempts: { used: 2, active: false } }), null);
});

const row = (over = {}) => ({
  id: 'c_1',
  type: 'mine',
  status: 'pending',
  attempt_number: 1,
  description: null,
  photo_id: null,
  found_neighborhood_id: null,
  found_neighborhood_name: null,
  created_at: '2026-10-24T10:00:00.000Z',
  expires_at: '2026-10-26T10:00:00.000Z',
  decided_at: null,
  publication_id: 'p_1',
  publication_title: 'Llaves',
  publication_type: 'found',
  publication_status: 'open',
  verification_answer: 'rojo',
  correct_answer: 'Rojo',
  publisher_id: 'u_pub',
  publisher_name: 'Pablo',
  publisher_photo_id: null,
  publisher_phone: '+54 11 1111-1111',
  publisher_phone_visible: true,
  claimer_id: 'u_cla',
  claimer_name: 'Clara',
  claimer_photo_id: PHOTO,
  claimer_phone: '+54 11 2222-2222',
  claimer_phone_visible: true,
  ...over,
});

test('el publicador ve la respuesta del solicitante y si coincide, pero nunca la correcta', () => {
  const view = toClaimView(row(), 'u_pub');
  assert.equal(view.role, 'publisher');
  assert.equal(view.verificationAnswer, 'rojo');
  assert.equal(view.answerMatches, true);
  assert.equal(toClaimView(row({ verification_answer: 'azul' }), 'u_pub').answerMatches, false);
  assert.ok(!JSON.stringify(view).includes('Rojo')); // la correcta es 'Rojo'; el solicitante escribió 'rojo'
  assert.equal(view.otherParty.name, 'Clara');
  assert.match(view.otherParty.photoUri, /\/photos\//);
});

test('el solicitante no ve ni su respuesta ni si coincide', () => {
  const view = toClaimView(row(), 'u_cla');
  assert.equal(view.role, 'claimer');
  assert.ok(!('verificationAnswer' in view));
  assert.ok(!('answerMatches' in view));
  assert.equal(view.otherParty.name, 'Pablo');
});

test('"Lo encontré": no hay respuesta que mostrar y sí barrio y foto', () => {
  const view = toClaimView(
    row({ type: 'found', publication_type: 'lost', verification_answer: null, correct_answer: null, photo_id: PHOTO, found_neighborhood_id: 'palermo', found_neighborhood_name: 'Palermo' }),
    'u_pub'
  );
  assert.ok(!('verificationAnswer' in view));
  assert.deepEqual(view.foundNeighborhood, { id: 'palermo', name: 'Palermo' });
  assert.match(view.photoUri, /\/photos\//);
});

test('el teléfono de la otra parte solo sale con reclamo aceptado y visible', () => {
  assert.equal(toClaimView(row({ status: 'pending' }), 'u_cla').otherParty.phone, null);
  assert.equal(toClaimView(row({ status: 'rejected' }), 'u_cla').otherParty.phone, null);
  assert.equal(toClaimView(row({ status: 'expired' }), 'u_pub').otherParty.phone, null);
  assert.equal(toClaimView(row({ status: 'accepted' }), 'u_cla').otherParty.phone, '+54 11 1111-1111');
  assert.equal(toClaimView(row({ status: 'accepted' }), 'u_pub').otherParty.phone, '+54 11 2222-2222');
  assert.equal(toClaimView(row({ status: 'accepted', publisher_phone_visible: false }), 'u_cla').otherParty.phone, null);
  assert.equal(toClaimView(row({ status: 'accepted', publisher_phone: '  ' }), 'u_cla').otherParty.phone, null);
});
