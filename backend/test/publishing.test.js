process.env.JWT_SECRET = 'x'.repeat(48);
process.env.PUBLIC_URL = 'http://test.local:3000';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPublicationInput, isValidPastDate, toOwnPublication, normalizeMultiline } = require('../src/services/publishing');

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const PHOTO = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const lost = (extra = {}) => ({
  clientId: UUID,
  type: 'lost',
  title: 'Llaves con llavero rojo',
  categoryId: 'keys',
  occurredOn: '2026-10-20',
  neighborhoodId: 'palermo',
  exactAddress: 'Av. Santa Fe 3200',
  ...extra,
});
const found = (extra = {}) =>
  lost({ type: 'found', verificationQuestion: '¿De qué color es el llavero?', verificationAnswer: 'Rojo', ...extra });
const errorOf = (body) => buildPublicationInput(body).error;

test('perdido válido: limpia textos y deja la verificación en null', () => {
  const { input } = buildPublicationInput(lost({ title: '  Llaves  ', description: '' }));
  assert.equal(input.title, 'Llaves');
  assert.equal(input.description, null);
  assert.equal(input.verificationQuestion, null);
  assert.equal(input.verificationAnswer, null);
  assert.deepEqual(input.photoIds, []);
});

test('perdido ignora pregunta y respuesta si vienen', () => {
  const { input } = buildPublicationInput(lost({ verificationQuestion: 'x', verificationAnswer: 'y' }));
  assert.equal(input.verificationQuestion, null);
  assert.equal(input.verificationAnswer, null);
});

test('encontrado exige pregunta y respuesta', () => {
  assert.ok(buildPublicationInput(found()).input);
  assert.match(errorOf(found({ verificationQuestion: ' ' })).message, /pregunta/);
  assert.match(errorOf(found({ verificationAnswer: undefined })).message, /respuesta/);
});

test('campos obligatorios', () => {
  assert.match(errorOf(lost({ clientId: 'abc' })).message, /identificador/);
  assert.match(errorOf(lost({ type: 'otro' })).message, /perdiste o encontraste/);
  assert.equal(errorOf(lost({ title: '   ' })).message, 'Escribí un título.');
  assert.match(errorOf(lost({ categoryId: undefined })).message, /categoría/);
  assert.match(errorOf(lost({ neighborhoodId: '' })).message, /barrio/);
  for (const b of [null, [], 'x']) assert.equal(errorOf(b).status, 422);
});

test('dirección o ubicación: alguna de las dos', () => {
  assert.match(errorOf(lost({ exactAddress: '' })).message, /dirección/);
  const { input } = buildPublicationInput(lost({ exactAddress: '', latitude: -34.58, longitude: '-58.42' }));
  assert.equal(input.latitude, -34.58);
  assert.equal(input.longitude, -58.42);
  assert.match(errorOf(lost({ latitude: -34.58 })).message, /ubicación/);
  assert.match(errorOf(lost({ latitude: 95, longitude: 0 })).message, /ubicación/);
});

test('franja horaria', () => {
  assert.equal(buildPublicationInput(lost({ timeFrom: '09:00', timeTo: '18:30' })).input.timeTo, '18:30');
  assert.match(errorOf(lost({ timeFrom: '9' })).message, /HH:MM/);
  assert.match(errorOf(lost({ timeFrom: '20:00', timeTo: '10:00' })).message, /posterior/);
});

test('fecha del suceso: válida y no futura', () => {
  const now = new Date('2026-10-27T15:00:00Z');
  assert.equal(isValidPastDate('2026-10-27', now), true);
  assert.equal(isValidPastDate('2026-10-28', now), true); // margen por zona horaria
  assert.equal(isValidPastDate('2026-11-05', now), false);
  assert.equal(isValidPastDate('2026-02-30', now), false);
  assert.equal(isValidPastDate('27/10/2026', now), false);
});

test('fotos: hasta 5, sin repetir y con formato de id', () => {
  assert.deepEqual(buildPublicationInput(lost({ photoIds: [PHOTO.toUpperCase()] })).input.photoIds, [PHOTO]);
  const six = Array.from({ length: 6 }, (_, i) => `${i}c9e6679-7425-40de-944b-e07fc1f90ae7`);
  assert.match(errorOf(lost({ photoIds: six })).message, /hasta 5/);
  assert.match(errorOf(lost({ photoIds: [PHOTO, PHOTO] })).message, /repetidas/);
  assert.match(errorOf(lost({ photoIds: ['x'] })).message, /fotos/);
});

test('textos con caracteres de control o demasiado largos', () => {
  assert.match(errorOf(lost({ title: 'a\u0000b' })).message, /no permitidos/);
  assert.match(errorOf(lost({ title: 'a'.repeat(81) })).message, /80/);
  assert.match(errorOf(lost({ description: 'a'.repeat(501) })).message, /500/);
});

test('toOwnPublication arma URLs de fotos y números', () => {
  const view = toOwnPublication({
    id: 'p_1', client_id: UUID, type: 'found', title: 't', description: null,
    category_id: 'keys', category_name: 'Llaves', occurred_on: '2026-10-20', time_from: '09:00:00', time_to: null,
    neighborhood_id: 'palermo', neighborhood_name: 'Palermo', exact_address: 'x', latitude: '-34.580000', longitude: '-58.420000',
    verification_question: 'q', verification_answer: 'a', status: 'open',
    expires_at: new Date('2026-11-19T00:00:00Z'), renewed_at: null, created_at: new Date('2026-10-20T00:00:00Z'),
    photo_ids: [PHOTO],
  });
  assert.equal(view.timeFrom, '09:00');
  assert.equal(view.latitude, -34.58);
  assert.deepEqual(view.photoUrls, [`http://test.local:3000/photos/${PHOTO}`]);
  assert.equal(view.category.name, 'Llaves');
});

test('descripción: acepta saltos de línea, los normaliza y sigue rechazando otros caracteres de control', () => {
  assert.equal(buildPublicationInput(lost({ description: 'uno\r\ndos\rtres' })).input.description, 'uno\ndos\ntres');
  assert.equal(normalizeMultiline('  a  \n\n\n\n b \n'), 'a\n\nb');
  assert.equal(buildPublicationInput(lost({ description: '\n \n' })).input.description, null);
  assert.match(errorOf(lost({ description: 'a\tb' })).message, /no permitidos/);
  assert.match(errorOf(lost({ description: 'a\u0000b' })).message, /no permitidos/);
  // en los demás campos el salto de línea sigue prohibido
  assert.match(errorOf(lost({ title: 'a\nb' })).message, /no permitidos/);
  assert.match(errorOf(lost({ exactAddress: 'a\nb' })).message, /no permitidos/);
  // el largo cuenta el texto normalizado: 500 caracteres con \r\n entran si ya normalizados caben
  assert.equal(buildPublicationInput(lost({ description: `${'a'.repeat(249)}\r\n${'b'.repeat(250)}` })).error, undefined);
  assert.match(errorOf(lost({ description: `${'a'.repeat(250)}\n${'b'.repeat(250)}` })).message, /500/);
});
