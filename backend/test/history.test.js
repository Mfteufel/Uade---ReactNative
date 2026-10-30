process.env.JWT_SECRET = 'x'.repeat(48);
process.env.PUBLIC_URL = 'http://test.local:3000';
// Nunca la base real: db.js lee backend/.env, pero dotenv no pisa lo que ya está definido.
process.env.DATABASE_URL = 'postgres://nadie:nada@127.0.0.1:1/nada';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../src/services/history');
const app = require('../src/index');
const { signAccessToken } = require('../src/services/tokens');

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-27T15:00:00.000Z');
const ago = (ms) => new Date(NOW.getTime() - ms);

// ----- parseHistoryFilters -----

test('parseHistoryFilters: sin parámetros usa los valores por defecto', () => {
  const { filters } = h.parseHistoryFilters({});
  assert.deepEqual(filters, { rol: null, from: null, to: null, tipo: null, categoria: null, page: 1, limit: 20 });
  assert.equal(h.parseHistoryFilters(undefined).filters.page, 1);
});

test('parseHistoryFilters: acepta tipo lost y found (tipo de la publicación)', () => {
  assert.equal(h.parseHistoryFilters({ tipo: 'lost' }).filters.tipo, 'lost');
  assert.equal(h.parseHistoryFilters({ tipo: 'found', categoria: 'keys' }).filters.tipo, 'found');
  assert.equal(h.parseHistoryFilters({ tipo: '' }).filters.tipo, null);
});

test('parseHistoryFilters: acepta rol, categoría, página y límite', () => {
  const { filters } = h.parseHistoryFilters({ rol: 'recupere', categoria: 'keys', pagina: '2', limite: '50' });
  assert.equal(filters.rol, 'recupere');
  assert.equal(filters.categoria, 'keys');
  assert.equal(filters.page, 2);
  assert.equal(filters.limit, 50);
});

test('parseHistoryFilters: desde y hasta son días de Buenos Aires, ambos incluidos', () => {
  const { filters } = h.parseHistoryFilters({ desde: '2026-10-01', hasta: '2026-10-31' });
  assert.equal(filters.from.toISOString(), '2026-10-01T03:00:00.000Z');
  assert.equal(filters.to.toISOString(), '2026-11-01T03:00:00.000Z'); // exclusivo: arranca el 1/11 (BA)
  assert.equal(h.parseHistoryFilters({ desde: '2026-10-05', hasta: '2026-10-05' }).error, undefined);
});

test('parseHistoryFilters: parámetros inválidos dan 422 en español', () => {
  const cases = [
    [{ rol: 'otro' }, /rol/],
    [{ desde: '2026-13-01' }, /desde/],
    [{ hasta: '01/10/2026' }, /hasta/],
    [{ desde: '2026-10-10', hasta: '2026-10-09' }, /posterior/],
    [{ tipo: 'perdido' }, /^El tipo no es válido\.$/],
    [{ tipo: 'LOST' }, /^El tipo no es válido\.$/],
    [{ tipo: ['lost'] }, /tipo/],
    [{ categoria: 'a b' }, /categoría/],
    [{ pagina: '0' }, /página/],
    [{ pagina: '1001' }, /página/],
    [{ pagina: 'x' }, /página/],
    [{ limite: '0' }, /límite/],
    [{ limite: '51' }, /límite/],
    [{ rol: ['devolvi'] }, /rol/],
  ];
  for (const [raw, re] of cases) {
    const r = h.parseHistoryFilters(raw);
    assert.equal(r.error?.status, 422, JSON.stringify(raw));
    assert.match(r.error.message, re, JSON.stringify(raw));
  }
});

// ----- plazo de 7 días -----

test('withinWindow: el borde de 7 días es inclusivo', () => {
  assert.equal(h.withinWindow(ago(7 * DAY - 1), NOW), true);
  assert.equal(h.withinWindow(ago(7 * DAY), NOW), true);
  assert.equal(h.withinWindow(ago(7 * DAY + 1), NOW), false);
  assert.equal(h.withinWindow(ago(0), NOW), true);
  assert.equal(h.withinWindow(new Date(NOW.getTime() + 1000), NOW), false); // fecha futura: no es válida
});

test('computeCanRate: dentro del plazo, con contraparte y sin valoración previa', () => {
  const base = { createdAt: ago(1 * DAY), now: NOW, hasCounterpart: true, alreadyRated: false };
  assert.equal(h.computeCanRate(base), true);
  assert.equal(h.computeCanRate({ ...base, createdAt: ago(7 * DAY) }), true);
  assert.equal(h.computeCanRate({ ...base, createdAt: ago(7 * DAY + 1) }), false);
  assert.equal(h.computeCanRate({ ...base, alreadyRated: true }), false);
  assert.equal(h.computeCanRate({ ...base, hasCounterpart: false }), false);
});

test('computeCanThank: solo quien recuperó, dentro del plazo y sin agradecimiento previo', () => {
  const base = { role: 'recupere', createdAt: ago(1 * DAY), now: NOW, alreadyThanked: false };
  assert.equal(h.computeCanThank(base), true);
  assert.equal(h.computeCanThank({ ...base, createdAt: ago(7 * DAY) }), true);
  assert.equal(h.computeCanThank({ ...base, createdAt: ago(7 * DAY + 1) }), false);
  assert.equal(h.computeCanThank({ ...base, alreadyThanked: true }), false);
  assert.equal(h.computeCanThank({ ...base, role: 'devolvi' }), false);
});

// ----- toHistoryItem -----

const row = (over = {}) => ({
  id: '7', // pg devuelve bigint como texto
  created_at: ago(1 * DAY),
  role: 'recupere',
  publication_title: 'Celular Samsung',
  publication_type: 'found',
  category_id: 'electronics',
  category_name: 'Electrónica',
  counterpart_id: 'u_carla',
  counterpart_name: 'Carla',
  counterpart_photo_id: '3f2c1a9e-0b7d-4c1e-9a8f-2d6b5e7c8a90',
  rating_positive: null,
  rating_comment: null,
  thanks_id: null,
  ...over,
});

test('toHistoryItem: arma el item completo, sin teléfono ni email de la contraparte', () => {
  const item = h.toHistoryItem(row(), NOW);
  assert.deepEqual(item, {
    id: 7,
    role: 'recupere',
    date: ago(1 * DAY).toISOString(),
    object: { title: 'Celular Samsung', type: 'found', category:{ id: 'electronics', name: 'Electrónica' } },
    counterpart: { id: 'u_carla', name: 'Carla', photoUri: 'http://test.local:3000/photos/3f2c1a9e-0b7d-4c1e-9a8f-2d6b5e7c8a90' },
    canRate: true,
    myRating: null,
    canThank: true,
    thanked: false,
  });
  assert.equal(typeof item.id, 'number');
  const json = JSON.stringify(item);
  assert.doesNotMatch(json, /phone|email/i);
});

test('toHistoryItem: con valoración y agradecimiento previos', () => {
  const item = h.toHistoryItem(row({ rating_positive: false, rating_comment: 'Llegó tarde', thanks_id: 'abc' }), NOW);
  assert.equal(item.canRate, false);
  assert.deepEqual(item.myRating, { positive: false, comment: 'Llegó tarde' });
  assert.equal(item.canThank, false);
  assert.equal(item.thanked, true);
});

test('toHistoryItem: valoración positiva sin comentario', () => {
  const item = h.toHistoryItem(row({ rating_positive: true }), NOW);
  assert.deepEqual(item.myRating, { positive: true, comment: null });
});

test('toHistoryItem: quien devolvió no puede agradecer', () => {
  const item = h.toHistoryItem(row({ role: 'devolvi' }), NOW);
  assert.equal(item.canThank, false);
  assert.equal(item.canRate, true);
});

test('toHistoryItem: pasados 7 días no se puede valorar ni agradecer', () => {
  const item = h.toHistoryItem(row({ created_at: ago(8 * DAY) }), NOW);
  assert.equal(item.canRate, false);
  assert.equal(item.canThank, false);
});

test('toHistoryItem: si falta el objeto o la contraparte salen en null, sin inventar datos', () => {
  const item = h.toHistoryItem(row({
    role: 'devolvi', publication_title: null, category_id: null, category_name: null,
    counterpart_id: null, counterpart_name: null, counterpart_photo_id: null,
  }), NOW);
  assert.equal(item.object, null);
  assert.equal(item.counterpart, null);
  assert.equal(item.canRate, false);
  assert.equal(item.canThank, false);
});

test('toHistoryItem: object.type trae el tipo de la publicación', () => {
  assert.equal(h.toHistoryItem(row({ publication_type: 'lost' }), NOW).object.type, 'lost');
  assert.equal(h.toHistoryItem(row(), NOW).object.type, 'found');
});

test('toHistoryItem: contraparte sin foto -> photoUri null', () => {
  assert.equal(h.toHistoryItem(row({ counterpart_photo_id: null }), NOW).counterpart.photoUri, null);
});

// ----- buildHistoryQuery -----

test('buildHistoryQuery: es de solo lectura, filtra por el usuario y pide uno más para hasMore', () => {
  const { text, params } = h.buildHistoryQuery(
    { rol: null, from: null, to: null, categoria: null, page: 2, limit: 10 }, 'u_x');
  assert.match(text, /^SELECT/);
  assert.doesNotMatch(text, /INSERT|UPDATE|DELETE|ALTER|DROP/i);
  assert.match(text, /r\.user_id = \$1 OR r\.recovered_by_id = \$1/);
  assert.deepEqual(params, ['u_x', 11, 10]);
});

test('buildHistoryQuery: excluye las devoluciones sin reclamo o sin quien recuperó, con cualquier rol', () => {
  for (const rol of [null, 'devolvi', 'recupere']) {
    const { text } = h.buildHistoryQuery({ rol, from: null, to: null, categoria: null, page: 1, limit: 20 }, 'u_x');
    assert.match(text, /AND r\.claim_id IS NOT NULL/, String(rol));
    assert.match(text, /AND r\.recovered_by_id IS NOT NULL/, String(rol));
  }
});

test('buildHistoryQuery: cada rol usa su columna y los filtros agregan parámetros', () => {
  const f = { from: new Date('2026-10-01T03:00:00Z'), to: new Date('2026-11-01T03:00:00Z'), categoria: 'keys', page: 1, limit: 5 };
  const dev = h.buildHistoryQuery({ ...f, rol: 'devolvi' }, 'u_x');
  assert.match(dev.text, /WHERE r\.user_id = \$1\n/);
  assert.doesNotMatch(dev.text, /r\.user_id = \$1 OR/);
  assert.match(dev.text, /p\.category_id = \$4/);
  assert.equal(dev.params.length, 6);
  const rec = h.buildHistoryQuery({ ...f, rol: 'recupere' }, 'u_x');
  assert.match(rec.text, /WHERE r\.recovered_by_id = \$1\n/);
  assert.doesNotMatch(rec.text, /p\.type = \$/);
});

test('buildHistoryQuery: tipo filtra por el tipo de la publicación y se suma a la categoría', () => {
  const q = h.buildHistoryQuery({ rol: 'devolvi', from: null, to: null, tipo: 'lost', categoria: 'keys', page: 1, limit: 20 }, 'u_x');
  assert.match(q.text, /p\.type = \$2/);
  assert.match(q.text, /p\.category_id = \$3/);
  assert.match(q.text, /p\.type AS publication_type/);
  assert.deepEqual(q.params, ['u_x', 'lost', 'keys', 21, 0]);
});

// ----- ruta -----

test('GET /historial requiere token', async () => {
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/historial`)).status, 401);
    const auth = { Authorization: `Bearer ${signAccessToken('u_test')}` };
    const r = await fetch(`${base}/historial?rol=otro`, { headers: auth });
    assert.equal(r.status, 422);
    assert.match((await r.json()).message, /rol/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
