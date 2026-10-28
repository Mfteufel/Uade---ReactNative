process.env.JWT_SECRET = 'x'.repeat(48);
process.env.PUBLIC_URL = 'http://test.local:3000';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  round3,
  haversineM,
  boundingBox,
  parseSearchFilters,
  parseRecentSearch,
  buildWhere,
  buildSearchQuery,
  toSearchItem,
  toRecentSearch,
} = require('../src/services/search');

const parse = (raw) => parseSearchFilters(raw);

test('filtros: el tipo es obligatorio y se usa tal cual (el servidor no invierte)', () => {
  assert.equal(parse({}).error.status, 422);
  assert.equal(parse({ tipo: 'x' }).error.status, 422);
  assert.equal(parse({ tipo: 'perdi' }).error.status, 422); // "situacion" ya no existe
  const ok = parse({ tipo: 'found' });
  assert.equal(ok.filters.tipo, 'found');
  assert.equal(ok.filters.orden, 'recientes');
  assert.equal(ok.filters.page, 1);
  assert.equal(ok.filters.limit, 20);
  assert.equal(parse({ tipo: 'lost' }).filters.tipo, 'lost');
});

test('filtros: situacion y periodo se ignoran en esta ruta', () => {
  const ok = parse({ tipo: 'found', situacion: 'perdi', periodo: '3d' });
  assert.ok(ok.filters);
  assert.ok(!('periodo' in ok.filters));
  assert.equal(ok.filters.range, null);
});

test('filtros: categoría, barrio y palabras clave', () => {
  const ok = parse({ tipo: 'found', categoria: 'keys', barrio: 'palermo', q: '  llaves osito ' });
  assert.equal(ok.filters.categoria, 'keys');
  assert.equal(ok.filters.barrio, 'palermo');
  assert.equal(ok.filters.q, 'llaves osito');
  assert.ok(parse({ tipo: 'found', categoria: 'a b' }).error);
  assert.ok(parse({ tipo: 'found', barrio: '../x' }).error);
  assert.ok(parse({ tipo: 'found', q: 'x'.repeat(101) }).error);
  assert.ok(parse({ tipo: 'found', q: 'a\u0000b' }).error);
  assert.ok(parse({ tipo: ['found', 'lost'] }).error); // parámetro repetido
});

test('filtros: zona con lat, lng y radio juntos', () => {
  const ok = parse({ tipo: 'found', lat: '-34.58', lng: '-58.42', radio: '1500' });
  assert.deepEqual(ok.filters.geo, { lat: -34.58, lng: -58.42, radius: 1500 });
  assert.ok(parse({ tipo: 'found', lat: '-34.58', lng: '-58.42' }).error); // falta radio
  assert.ok(parse({ tipo: 'found', lat: '-34.58', radio: '1500' }).error); // falta lng
  assert.ok(parse({ tipo: 'found', lat: '91', lng: '0', radio: '1500' }).error);
  assert.ok(parse({ tipo: 'found', lat: '0', lng: '181', radio: '1500' }).error);
  assert.ok(parse({ tipo: 'found', lat: 'abc', lng: '0', radio: '1500' }).error);
  assert.ok(parse({ tipo: 'found', lat: '0', lng: '0', radio: '99' }).error);
  assert.ok(parse({ tipo: 'found', lat: '0', lng: '0', radio: '50001' }).error);
  assert.ok(parse({ tipo: 'found', lat: '0', lng: '0', radio: '10.5' }).error);
  assert.equal(parse({ tipo: 'found', lat: '0', lng: '0', radio: '100' }).filters.geo.radius, 100);
});

test('filtros: orden, página y límite', () => {
  assert.ok(parse({ tipo: 'found', orden: 'raro' }).error);
  // cercanos necesita un centro: lat/lng o barrio
  assert.equal(parse({ tipo: 'found', orden: 'cercanos' }).error.status, 422);
  assert.equal(parse({ tipo: 'found', orden: 'cercanos', barrio: 'palermo' }).filters.orden, 'cercanos');
  assert.equal(parse({ tipo: 'found', orden: 'cercanos', lat: '1', lng: '1', radio: '500' }).filters.orden, 'cercanos');
  assert.equal(parse({ tipo: 'found', pagina: '3', limite: '50' }).filters.page, 3);
  assert.equal(parse({ tipo: 'found', limite: '50' }).filters.limit, 50);
  for (const bad of [{ pagina: '0' }, { pagina: '-1' }, { pagina: 'x' }, { limite: '0' }, { limite: '51' }, { limite: '1.5' }]) {
    assert.equal(parse({ tipo: 'found', ...bad }).error.status, 422);
  }
});

test('filtros: desde y hasta (AAAA-MM-DD), juntos o por separado', () => {
  assert.deepEqual(parse({ tipo: 'found', desde: '2026-10-01', hasta: '2026-10-15' }).filters.range, { from: '2026-10-01', to: '2026-10-15' });
  assert.deepEqual(parse({ tipo: 'found', desde: '2026-10-01' }).filters.range, { from: '2026-10-01', to: null });
  assert.deepEqual(parse({ tipo: 'found', hasta: '2026-10-15' }).filters.range, { from: null, to: '2026-10-15' });
  assert.equal(parse({ tipo: 'found', desde: '2026-10-15', hasta: '2026-10-15' }).filters.range.from, '2026-10-15');
  assert.ok(parse({ tipo: 'found', desde: '2026-02-30' }).error);
  assert.ok(parse({ tipo: 'found', desde: '01/10/2026' }).error);
  assert.ok(parse({ tipo: 'found', hasta: 'ayer' }).error);
  assert.ok(parse({ tipo: 'found', desde: '2026-10-16', hasta: '2026-10-15' }).error);
});

const rec = (raw) => parseRecentSearch(raw);

test('reciente: mismos criterios más período; el tipo es obligatorio', () => {
  assert.equal(rec({}).error.status, 422);
  assert.equal(rec('hola').error.status, 422);
  assert.equal(rec([]).error.status, 422);
  const ok = rec({ tipo: 'lost', categoria: 'keys', q: 'osito', barrio: 'palermo', lat: -34.58, lng: -58.42, radio: 1500, periodo: '3d' });
  assert.equal(ok.filters.tipo, 'lost');
  assert.equal(ok.filters.periodo, '3d');
  assert.equal(ok.filters.range, null);
  assert.deepEqual(ok.filters.geo, { lat: -34.58, lng: -58.42, radius: 1500 });
  assert.ok(!('orden' in ok.filters));
  assert.equal(rec({ tipo: 'found' }).filters.periodo, null);
});

test('reciente: períodos válidos y desde/hasta solo con rango', () => {
  for (const periodo of ['hoy', '3d', '7d']) assert.equal(rec({ tipo: 'found', periodo }).filters.periodo, periodo);
  assert.ok(rec({ tipo: 'found', periodo: 'ayer' }).error);
  assert.ok(rec({ tipo: 'found', periodo: 'hoy', desde: '2026-10-01' }).error);
  assert.ok(rec({ tipo: 'found', desde: '2026-10-01', hasta: '2026-10-02' }).error); // sin período
  assert.ok(rec({ tipo: 'found', periodo: 'rango' }).error);
  assert.ok(rec({ tipo: 'found', periodo: 'rango', desde: '2026-10-01' }).error);
  assert.ok(rec({ tipo: 'found', periodo: 'rango', desde: '2026-02-30', hasta: '2026-03-01' }).error);
  assert.ok(rec({ tipo: 'found', periodo: 'rango', desde: '2026-10-16', hasta: '2026-10-15' }).error);
  const ok = rec({ tipo: 'found', periodo: 'rango', desde: '2026-10-01', hasta: '2026-10-15' });
  assert.equal(ok.filters.periodo, 'rango');
  assert.deepEqual(ok.filters.range, { from: '2026-10-01', to: '2026-10-15' });
});

test('Haversine', () => {
  assert.equal(haversineM(-34.58, -58.42, -34.58, -58.42), 0);
  // Obelisco -> Plaza Italia: ~4,2 km
  const d = haversineM(-34.6037, -58.3816, -34.5810, -58.4260);
  assert.ok(d > 4000 && d < 4800, `distancia ${d}`);
  // un grado de latitud ~111,2 km
  assert.ok(Math.abs(haversineM(0, 0, 1, 0) - 111195) < 100);
  // simétrica
  assert.ok(Math.abs(haversineM(-34.6, -58.4, -34.5, -58.3) - haversineM(-34.5, -58.3, -34.6, -58.4)) < 1e-6);
});

test('rectángulo previo contiene el círculo', () => {
  const box = boundingBox(-34.58, -58.42, 1000);
  assert.ok(box.minLat < -34.58 && box.maxLat > -34.58);
  assert.ok(box.minLng < -58.42 && box.maxLng > -58.42);
  const north = haversineM(-34.58, -58.42, box.maxLat, -58.42);
  assert.ok(Math.abs(north - 1000) < 5);
  const east = haversineM(-34.58, -58.42, -34.58, box.maxLng);
  assert.ok(Math.abs(east - 1000) < 5);
});

test('redondeo de coordenadas a 3 decimales', () => {
  assert.equal(round3(-34.58123), -34.581);
  assert.equal(round3('-58.42678'), -58.427);
  assert.equal(round3(10), 10);
  assert.equal(round3(null), null);
  assert.equal(round3(undefined), null);
});

test('WHERE básico: el tipo pedido, vigentes y sin las propias', () => {
  const { filters } = parse({ tipo: 'found' });
  const { clauses, params } = buildWhere(filters, 'u_yo');
  assert.deepEqual(params, ['found', 'u_yo']);
  assert.deepEqual(clauses, [
    'p.type = $1',
    "p.status IN ('open', 'in_claim')",
    'p.expires_at > now()',
    'p.user_id <> $2',
  ]);
});

test('WHERE con todos los filtros', () => {
  const { filters } = parse({
    tipo: 'lost', categoria: 'keys', q: 'osito', barrio: 'palermo',
    desde: '2026-10-01', hasta: '2026-10-15', lat: '-34.58', lng: '-58.42', radio: '1000',
  });
  const { clauses, params } = buildWhere(filters, 'u_yo');
  const sql = clauses.join(' AND ');
  assert.match(sql, /p\.type = \$1/);
  assert.match(sql, /p\.category_id = \$3/);
  assert.match(sql, /p\.search_tsv @@ plainto_tsquery\('spanish', \$4\)/);
  assert.match(sql, /numnode\(plainto_tsquery\('spanish', \$4\)\) = 0 OR/); // q de palabras vacías: se ignora el filtro
  assert.match(sql, /p\.neighborhood_id = \$5/);
  assert.match(sql, /p\.occurred_on >= \$6::date/);
  assert.match(sql, /p\.occurred_on <= \$7::date/);
  assert.match(sql, /round\(COALESCE\(p\.latitude, n\.center_lat\)::numeric, 3\) BETWEEN \$8 AND \$9/);
  assert.match(sql, /round\(COALESCE\(p\.longitude, n\.center_lng\)::numeric, 3\) BETWEEN \$10 AND \$11/);
  assert.match(sql, /<= \$14/);
  assert.equal(params.length, 14);
  assert.deepEqual(params.slice(0, 7), ['lost', 'u_yo', 'keys', 'osito', 'palermo', '2026-10-01', '2026-10-15']);
  assert.equal(params[11], -34.58); // lat del Haversine
  assert.equal(params[12], -58.42);
  assert.equal(params[13], 1000);
});

test('WHERE: con solo desde o solo hasta usa una condición', () => {
  const soloDesde = buildWhere(parse({ tipo: 'found', desde: '2026-10-01' }).filters, 'u_yo');
  assert.equal(soloDesde.clauses.filter((c) => c.includes('occurred_on')).length, 1);
  assert.match(soloDesde.clauses.join(' '), /occurred_on >= \$3::date/);
  const soloHasta = buildWhere(parse({ tipo: 'found', hasta: '2026-10-15' }).filters, 'u_yo');
  assert.match(soloHasta.clauses.join(' '), /occurred_on <= \$3::date/);
  assert.ok(!/occurred_on >=/.test(soloHasta.clauses.join(' ')));
});

test('WHERE: nunca interpola valores del usuario en el SQL', () => {
  const { filters } = parse({ tipo: 'found', q: "'; DROP TABLE publications; --", categoria: 'keys' });
  const { clauses } = buildWhere(filters, 'u_yo');
  assert.ok(!clauses.join(' ').includes('DROP'));
});

test('consulta completa: paginación y orden', () => {
  const recientes = buildSearchQuery(parse({ tipo: 'found', pagina: '3', limite: '10' }).filters, 'u_yo', null);
  assert.match(recientes.text, /ORDER BY p\.created_at DESC, p\.id DESC/);
  assert.match(recientes.text, /LIMIT \$3 OFFSET \$4/);
  assert.deepEqual(recientes.params, ['found', 'u_yo', 11, 20]); // pide uno de más para hasMore
  assert.ok(!/distance_m/.test(recientes.text));

  const cercanos = buildSearchQuery(parse({ tipo: 'found', orden: 'cercanos', barrio: 'palermo' }).filters, 'u_yo', { lat: -34.579, lng: -58.4298 });
  assert.match(cercanos.text, /AS distance_m/);
  assert.match(cercanos.text, /ORDER BY distance_m ASC/);
  assert.ok(!/exact_address|verification_/.test(cercanos.text)); // nunca se seleccionan
  assert.ok(cercanos.params.includes(-34.579));
});

const row = (over = {}) => ({
  id: 'p_1',
  type: 'found',
  title: 'Llaves',
  status: 'open',
  category_id: 'keys',
  category_name: 'Llaves',
  neighborhood_id: 'palermo',
  neighborhood_name: 'Palermo',
  occurred_on: '2026-10-24',
  time_from: '09:00',
  time_to: null,
  latitude: '-34.581234',
  longitude: '-58.426789',
  ...over,
});

test('item: forma de la respuesta, coordenadas redondeadas y fotos en orden', () => {
  const PHOTO = '3f2c1a9e-0b7d-4c1e-9a8f-2d6b5e7c8a90';
  const item = toSearchItem(row({ exact_address: 'Calle 123', verification_question: '¿?', verification_answer: 'x' }), [PHOTO]);
  assert.deepEqual(item, {
    id: 'p_1',
    type: 'found',
    title: 'Llaves',
    status: 'open',
    category: { id: 'keys', name: 'Llaves' },
    neighborhood: { id: 'palermo', name: 'Palermo' },
    occurredOn: '2026-10-24',
    timeFrom: '09:00',
    timeTo: null,
    lat: -34.581,
    lng: -58.427,
    photoUrls: [`http://test.local:3000/photos/${PHOTO}`],
  });
  const text = JSON.stringify(item);
  assert.ok(!/exact_address|verification|Calle 123/.test(text));
  assert.ok(!('distanceM' in item));
});

test('item: distanceM solo con orden cercanos; sin coordenadas da null', () => {
  assert.equal(toSearchItem(row({ distance_m: '1234.56' }), [], { withDistance: true }).distanceM, 1200);
  assert.equal(toSearchItem(row({ distance_m: 1250 }), [], { withDistance: true }).distanceM, 1300);
  assert.equal(toSearchItem(row({ distance_m: 49.9 }), [], { withDistance: true }).distanceM, 0);
  assert.equal(toSearchItem(row({ distance_m: 0 }), [], { withDistance: true }).distanceM, 0);
  const sin = toSearchItem(row({ latitude: null, longitude: null }));
  assert.equal(sin.lat, null);
  assert.equal(sin.lng, null);
  assert.deepEqual(sin.photoUrls, []);
});

test('búsqueda reciente: devuelve los mismos campos que el POST', () => {
  const view = toRecentSearch({
    id: 'u1', type: 'found', category_id: 'keys', keywords: 'llaves', neighborhood_id: 'palermo',
    latitude: '-34.579000', longitude: '-58.429800', radius_m: 1500, period: 'range', date_from: '2026-09-27', date_to: '2026-10-27',
    created_at: new Date('2026-10-27T10:00:00.000Z'),
  });
  assert.deepEqual(view, {
    id: 'u1', tipo: 'found', categoria: 'keys', q: 'llaves', barrio: 'palermo',
    lat: -34.579, lng: -58.4298, radio: 1500, periodo: 'rango', desde: '2026-09-27', hasta: '2026-10-27',
    createdAt: '2026-10-27T10:00:00.000Z',
  });
  const min = toRecentSearch({ id: 'u2', type: 'lost', category_id: null, keywords: null, neighborhood_id: null, latitude: null, longitude: null, radius_m: null, period: null, date_from: null, date_to: null, created_at: '2026-10-27T10:00:00.000Z' });
  assert.equal(min.tipo, 'lost');
  assert.equal(min.lat, null);
  assert.equal(min.radio, null);
  assert.equal(min.periodo, null);
  // período relativo: se guarda sin fechas y se devuelve tal cual
  const rel = toRecentSearch({ ...min, period: '3d' });
  assert.equal(rel.periodo, '3d');
  assert.equal(rel.desde, null);
  assert.equal(toRecentSearch({ ...min, period: 'today' }).periodo, 'hoy');
  // fila vieja: fechas sin period
  assert.equal(toRecentSearch({ ...min, period: null, date_from: '2026-09-01', date_to: '2026-09-02' }).periodo, 'rango');
});

test('buildWhere: q con solo palabras vacías no filtra (numnode = 0) y q normal sí', () => {
  const { clauses, params } = buildWhere({ tipo: 'found', q: 'de la', range: null }, 'u_x');
  const clause = clauses.find((c) => c.includes('plainto_tsquery'));
  assert.match(clause, /^\(numnode\(plainto_tsquery\('spanish', \$3\)\) = 0 OR p\.search_tsv @@ plainto_tsquery\('spanish', \$3\)\)$/);
  assert.equal(params.filter((p) => p === 'de la').length, 1); // un solo parámetro, usado dos veces
});
