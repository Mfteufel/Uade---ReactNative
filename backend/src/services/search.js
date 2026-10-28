const { query, withTransaction } = require('../db');
const { HttpError } = require('../middleware/errors');
const { FORBIDDEN_CHARS } = require('./profile');
const { photoUrl } = require('./photoUrl');

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const INT_RE = /^\d+$/;
const MAX_Q_LEN = 100;
const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 50000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_PAGE = 1000;
const MAX_RECENT = 10;
const EARTH_RADIUS_M = 6371000;

// ---------------------------------------------------------------------------
// Funciones puras (se testean sin base de datos)
// ---------------------------------------------------------------------------

const fail = (message) => ({ error: { status: 422, message } });

// Tipo de publicación que se devuelve: la app decide cuál pedir (el servidor no invierte nada).
const TYPES = ['lost', 'found'];

const roundTo = (n, digits) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};
// Las coordenadas que salen en los resultados se redondean (~110 m) para no revelar el lugar exacto.
const round3 = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? null : roundTo(Number(n), 3));

// periodo de la API <-> recent_searches.period
const PERIOD_TO_DB = { hoy: 'today', '3d': '3d', '7d': '7d', rango: 'range' };
const PERIOD_FROM_DB = { today: 'hoy', '3d': '3d', '7d': '7d', range: 'rango' };

const toRad = (deg) => (deg * Math.PI) / 180;

// Distancia en metros entre dos puntos (Haversine).
function haversineM(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Rectángulo que contiene el círculo (filtro barato previo al Haversine).
function boundingBox(lat, lng, radiusM) {
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const cos = Math.max(Math.cos(toRad(lat)), 0.01);
  const dLng = dLat / cos;
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

const isValidDate = (s) => {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

// Lee un campo de texto opcional. Devuelve { value } (undefined si no vino) o { error }.
function readText(raw, key) {
  const v = raw[key];
  if (v === undefined || v === null || v === '') return { value: undefined };
  if (typeof v === 'number') return { value: String(v) };
  if (typeof v !== 'string') return fail(`El parámetro ${key} no es válido.`);
  const s = v.trim();
  return { value: s === '' ? undefined : s };
}

const CRITERIA_KEYS = ['tipo', 'categoria', 'q', 'barrio', 'lat', 'lng', 'radio'];

// Lee los campos de texto de `keys`. Devuelve { text } o { error }.
function readFields(raw, keys) {
  const text = {};
  for (const key of keys) {
    const r = readText(raw, key);
    if (r.error) return r;
    text[key] = r.value;
  }
  return { text };
}

// Criterios comunes a la búsqueda y a las recientes: tipo, categoria, q, barrio y zona (lat, lng, radio).
function parseCriteria(text) {
  if (!text.tipo) return fail('Indicá el tipo: lost o found.');
  if (!TYPES.includes(text.tipo)) return fail('El tipo tiene que ser lost o found.');

  let categoria = null;
  if (text.categoria !== undefined) {
    if (!ID_RE.test(text.categoria)) return fail('La categoría no es válida.');
    categoria = text.categoria;
  }

  let q = null;
  if (text.q !== undefined) {
    if (FORBIDDEN_CHARS.test(text.q)) return fail('Las palabras clave tienen caracteres no permitidos.');
    if (text.q.length > MAX_Q_LEN) return fail(`Las palabras clave no pueden superar los ${MAX_Q_LEN} caracteres.`);
    q = text.q;
  }

  let barrio = null;
  if (text.barrio !== undefined) {
    if (!ID_RE.test(text.barrio)) return fail('El barrio no es válido.');
    barrio = text.barrio;
  }

  let geo = null;
  if (text.lat !== undefined || text.lng !== undefined || text.radio !== undefined) {
    if (text.lat === undefined || text.lng === undefined || text.radio === undefined) {
      return fail('Para buscar por zona hacen falta lat, lng y radio.');
    }
    if (!NUMBER_RE.test(text.lat) || Math.abs(Number(text.lat)) > 90) return fail('La latitud tiene que estar entre -90 y 90.');
    if (!NUMBER_RE.test(text.lng) || Math.abs(Number(text.lng)) > 180) return fail('La longitud tiene que estar entre -180 y 180.');
    if (!INT_RE.test(text.radio) || Number(text.radio) < MIN_RADIUS_M || Number(text.radio) > MAX_RADIUS_M) {
      return fail(`El radio tiene que estar entre ${MIN_RADIUS_M} y ${MAX_RADIUS_M} metros.`);
    }
    geo = { lat: roundTo(Number(text.lat), 6), lng: roundTo(Number(text.lng), 6), radius: Number(text.radio) };
  }

  return { criteria: { tipo: text.tipo, categoria, q, barrio, geo } };
}

const checkObject = (raw) => (raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? null : fail('El cuerpo debe ser un objeto JSON.'));

// Valida el query string de GET /publicaciones.
// Fechas del suceso: desde y hasta son opcionales por separado. orden, pagina y limite los agrega la consigna.
// Devuelve { filters } o { error: { status, message } }.
function parseSearchFilters(raw) {
  if (raw === undefined || raw === null) raw = {};
  const bad = checkObject(raw);
  if (bad) return bad;

  const read = readFields(raw, [...CRITERIA_KEYS, 'desde', 'hasta', 'orden', 'pagina', 'limite']);
  if (read.error) return read;
  const { text } = read;

  const parsed = parseCriteria(text);
  if (parsed.error) return parsed;
  const { criteria } = parsed;

  for (const key of ['desde', 'hasta']) {
    if (text[key] !== undefined && !isValidDate(text[key])) return fail(`La fecha ${key} tiene que tener el formato AAAA-MM-DD.`);
  }
  if (text.desde && text.hasta && text.desde > text.hasta) return fail('La fecha desde no puede ser posterior a hasta.');
  const range = text.desde || text.hasta ? { from: text.desde || null, to: text.hasta || null } : null;

  let orden = 'recientes';
  if (text.orden !== undefined) {
    if (!['recientes', 'cercanos'].includes(text.orden)) return fail('El orden tiene que ser recientes o cercanos.');
    orden = text.orden;
  }
  if (orden === 'cercanos' && !criteria.geo && !criteria.barrio) {
    return fail('Para ordenar por cercanía indicá un barrio o lat, lng y radio.');
  }

  let page = 1;
  if (text.pagina !== undefined) {
    if (!INT_RE.test(text.pagina) || Number(text.pagina) < 1 || Number(text.pagina) > MAX_PAGE) {
      return fail(`La página tiene que ser un número entre 1 y ${MAX_PAGE}.`);
    }
    page = Number(text.pagina);
  }
  let limit = DEFAULT_LIMIT;
  if (text.limite !== undefined) {
    if (!INT_RE.test(text.limite) || Number(text.limite) < 1 || Number(text.limite) > MAX_LIMIT) {
      return fail(`El límite tiene que ser un número entre 1 y ${MAX_LIMIT}.`);
    }
    limit = Number(text.limite);
  }

  return { filters: { ...criteria, range, orden, page, limit } };
}

// Valida el body de POST /busquedas-recientes: los mismos criterios más el período (hoy | 3d | 7d | rango).
// El período se guarda tal cual; desde y hasta solo existen con rango (y entonces son obligatorios).
function parseRecentSearch(raw) {
  if (raw === undefined || raw === null) raw = {};
  const bad = checkObject(raw);
  if (bad) return bad;

  const read = readFields(raw, [...CRITERIA_KEYS, 'periodo', 'desde', 'hasta']);
  if (read.error) return read;
  const { text } = read;

  const parsed = parseCriteria(text);
  if (parsed.error) return parsed;

  let periodo = null;
  if (text.periodo !== undefined) {
    if (!PERIOD_TO_DB[text.periodo]) return fail('El período tiene que ser hoy, 3d, 7d o rango.');
    periodo = text.periodo;
  }
  let range = null;
  if (periodo === 'rango') {
    if (text.desde === undefined || text.hasta === undefined) return fail('Para el período rango hacen falta desde y hasta.');
    if (!isValidDate(text.desde) || !isValidDate(text.hasta)) return fail('Las fechas tienen que tener el formato AAAA-MM-DD.');
    if (text.desde > text.hasta) return fail('La fecha desde no puede ser posterior a hasta.');
    range = { from: text.desde, to: text.hasta };
  } else if (text.desde !== undefined || text.hasta !== undefined) {
    return fail('desde y hasta solo se usan con el período rango.');
  }

  return { filters: { ...parsed.criteria, periodo, range } };
}

// Acumula parámetros posicionales ($1, $2...).
function createParams(initial = []) {
  const params = [...initial];
  return { params, add: (value) => { params.push(value); return `$${params.length}`; } };
}

// Distancia Haversine en SQL (metros) entre las coordenadas efectivas de la publicación y el centro.
// Si la publicación no tiene coordenadas propias se usa el centro de su barrio.
// Privacidad: el filtro por radio y el orden por cercanía usan SIEMPRE las coordenadas redondeadas a 3 decimales
// (las mismas que se muestran), nunca las exactas; con el centro del barrio se aplica el mismo redondeo.
const EFF_LAT = 'round(COALESCE(p.latitude, n.center_lat)::numeric, 3)';
const EFF_LNG = 'round(COALESCE(p.longitude, n.center_lng)::numeric, 3)';
function distanceSql(latParam, lngParam) {
  return `(2 * ${EARTH_RADIUS_M} * asin(least(1, sqrt(
    power(sin(radians(${EFF_LAT} - ${latParam}) / 2), 2)
    + cos(radians(${latParam})) * cos(radians(${EFF_LAT})) * power(sin(radians(${EFF_LNG} - ${lngParam}) / 2), 2)
  ))))`;
}

// Arma las condiciones del WHERE. Siempre: el tipo recibido (la app ya pide el que corresponde), vigente (open/in_claim, sin vencer) y no propia.
// Devuelve { clauses, params } con $1.. en orden.
function buildWhere(filters, userId) {
  const { add, params } = createParams();
  const clauses = [
    `p.type = ${add(filters.tipo)}`,
    "p.status IN ('open', 'in_claim')",
    'p.expires_at > now()',
    `p.user_id <> ${add(userId)}`,
  ];
  if (filters.categoria) clauses.push(`p.category_id = ${add(filters.categoria)}`);
  if (filters.q) {
    // Si q son solo palabras vacías ("de la"), plainto_tsquery queda sin términos (numnode = 0): se ignora el filtro.
    const qp = add(filters.q);
    clauses.push(`(numnode(plainto_tsquery('spanish', ${qp})) = 0 OR p.search_tsv @@ plainto_tsquery('spanish', ${qp}))`);
  }
  if (filters.barrio) clauses.push(`p.neighborhood_id = ${add(filters.barrio)}`);
  if (filters.range && filters.range.from) clauses.push(`p.occurred_on >= ${add(filters.range.from)}::date`);
  if (filters.range && filters.range.to) clauses.push(`p.occurred_on <= ${add(filters.range.to)}::date`);
  if (filters.geo) {
    const { lat, lng, radius } = filters.geo;
    const box = boundingBox(lat, lng, radius);
    clauses.push(`${EFF_LAT} BETWEEN ${add(box.minLat)} AND ${add(box.maxLat)}`);
    clauses.push(`${EFF_LNG} BETWEEN ${add(box.minLng)} AND ${add(box.maxLng)}`);
    clauses.push(`${distanceSql(add(lat), add(lng))} <= ${add(radius)}`);
  }
  return { clauses, params };
}

// Consulta completa. `center` ({lat, lng}) es el punto para ordenar por cercanía (obligatorio con orden cercanos).
function buildSearchQuery(filters, userId, center) {
  const { clauses, params } = buildWhere(filters, userId);
  const ctx = createParams(params); // sigue la numeración de buildWhere
  const near = filters.orden === 'cercanos';
  const dist = near ? distanceSql(ctx.add(center.lat), ctx.add(center.lng)) : null;
  const limitP = ctx.add(filters.limit + 1);
  const offsetP = ctx.add((filters.page - 1) * filters.limit);
  const order = near ? 'distance_m ASC, p.created_at DESC, p.id DESC' : 'p.created_at DESC, p.id DESC';
  const text = `SELECT p.id, p.type, p.title, p.status, p.category_id, c.name AS category_name,
       p.neighborhood_id, n.name AS neighborhood_name,
       to_char(p.occurred_on, 'YYYY-MM-DD') AS occurred_on,
       to_char(p.time_from, 'HH24:MI') AS time_from, to_char(p.time_to, 'HH24:MI') AS time_to,
       p.latitude, p.longitude${near ? `, ${dist} AS distance_m` : ''}
  FROM publications p
  JOIN categories c ON c.id = p.category_id
  JOIN neighborhoods n ON n.id = p.neighborhood_id
 WHERE ${clauses.join('\n   AND ')}
 ORDER BY ${order}
 LIMIT ${limitP} OFFSET ${offsetP}`;
  return { text, params: ctx.params };
}

// Fila de la base -> item de la respuesta. Nunca incluye dirección exacta ni datos de verificación.
function toSearchItem(row, photoIds = [], { withDistance = false } = {}) {
  const item = {
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    category: { id: row.category_id, name: row.category_name },
    neighborhood: { id: row.neighborhood_id, name: row.neighborhood_name },
    occurredOn: row.occurred_on,
    timeFrom: row.time_from ?? null,
    timeTo: row.time_to ?? null,
    lat: round3(row.latitude),
    lng: round3(row.longitude),
    photoUrls: photoIds.map(photoUrl),
  };
  if (withDistance) item.distanceM = row.distance_m === null || row.distance_m === undefined ? null : roundTo(Number(row.distance_m) / 100, 0) * 100; // múltiplos de 100 m
  return item;
}

// Fila de recent_searches -> objeto con los mismos nombres que usa la búsqueda.
function toRecentSearch(row) {
  const out = {
    id: row.id,
    tipo: row.type,
    categoria: row.category_id ?? null,
    q: row.keywords ?? null,
    barrio: row.neighborhood_id ?? null,
    lat: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    lng: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    radio: row.radius_m ?? null,
    // Filas viejas sin period pero con fechas se leen como rango.
    periodo: PERIOD_FROM_DB[row.period] || (row.date_from || row.date_to ? 'rango' : null),
    desde: row.date_from ?? null,
    hasta: row.date_to ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
  return out;
}

// ---------------------------------------------------------------------------
// Con base de datos
// ---------------------------------------------------------------------------

async function listCategories() {
  const r = await query('SELECT id, name FROM categories ORDER BY sort_order, name');
  return r.rows;
}

// Centro para ordenar por cercanía: lat/lng si vinieron; si no, el centro del barrio.
async function resolveCenter(filters) {
  if (filters.geo) return { lat: filters.geo.lat, lng: filters.geo.lng };
  const r = await query('SELECT center_lat, center_lng FROM neighborhoods WHERE id = $1', [filters.barrio]);
  if (r.rowCount === 0) throw new HttpError(422, 'El barrio no existe.');
  return { lat: Number(r.rows[0].center_lat), lng: Number(r.rows[0].center_lng) };
}

async function search(userId, rawQuery) {
  const parsed = parseSearchFilters(rawQuery);
  if (parsed.error) throw new HttpError(parsed.error.status, parsed.error.message);
  const { filters } = parsed;

  const near = filters.orden === 'cercanos';
  const center = near ? await resolveCenter(filters) : null;
  const q = buildSearchQuery(filters, userId, center);
  const r = await query(q.text, q.params);

  const hasMore = r.rows.length > filters.limit;
  const rows = hasMore ? r.rows.slice(0, filters.limit) : r.rows;

  const photos = new Map();
  if (rows.length > 0) {
    const pr = await query(
      'SELECT publication_id, photo_id FROM publication_photos WHERE publication_id = ANY($1) ORDER BY publication_id, position',
      [rows.map((row) => row.id)]
    );
    for (const row of pr.rows) {
      if (!photos.has(row.publication_id)) photos.set(row.publication_id, []);
      photos.get(row.publication_id).push(row.photo_id);
    }
  }

  return {
    items: rows.map((row) => toSearchItem(row, photos.get(row.id) || [], { withDistance: near })),
    page: filters.page,
    limit: filters.limit,
    hasMore,
  };
}

const RECENT_COLUMNS = `id, type, category_id, keywords, neighborhood_id, latitude, longitude, radius_m, period,
       to_char(date_from, 'YYYY-MM-DD') AS date_from, to_char(date_to, 'YYYY-MM-DD') AS date_to, created_at`;

async function listRecent(userId) {
  const r = await query(
    `SELECT ${RECENT_COLUMNS} FROM recent_searches WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT ${MAX_RECENT}`,
    [userId]
  );
  return r.rows.map(toRecentSearch);
}

// Borra una búsqueda reciente propia. Si no existe o es de otro usuario: 404 (no se distingue).
async function deleteRecent(userId, id) {
  if (!UUID_RE.test(id)) throw new HttpError(404, 'Búsqueda no encontrada.');
  const r = await query('DELETE FROM recent_searches WHERE id = $1 AND user_id = $2', [id, userId]);
  if (r.rowCount === 0) throw new HttpError(404, 'Búsqueda no encontrada.');
}

// Guarda la búsqueda. Si ya hay una idéntica, solo actualiza su created_at. Conserva las últimas 10.
async function saveRecent(userId, body) {
  const parsed = parseRecentSearch(body);
  if (parsed.error) throw new HttpError(parsed.error.status, parsed.error.message);
  const f = parsed.filters;

  if (f.categoria) {
    const c = await query('SELECT 1 FROM categories WHERE id = $1', [f.categoria]);
    if (c.rowCount === 0) throw new HttpError(422, 'La categoría no existe.');
  }
  if (f.barrio) {
    const n = await query('SELECT 1 FROM neighborhoods WHERE id = $1', [f.barrio]);
    if (n.rowCount === 0) throw new HttpError(422, 'El barrio no existe.');
  }

  const values = [
    f.tipo, f.categoria, f.q, f.barrio,
    f.geo ? f.geo.lat : null, f.geo ? f.geo.lng : null, f.geo ? f.geo.radius : null,
    // hoy/3d/7d guardan solo el período (son relativos al día en que se repite); rango guarda las fechas.
    f.periodo ? PERIOD_TO_DB[f.periodo] : null,
    f.periodo === 'rango' ? f.range.from : null, f.periodo === 'rango' ? f.range.to : null,
  ];

  return withTransaction(async (c) => {
    // Serializa los guardados del mismo usuario para no duplicar ni pasarse de 10.
    const lock = await c.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (lock.rowCount === 0) throw new HttpError(401, 'Sesión inválida. Volvé a iniciar sesión.');

    let r = await c.query(
      `UPDATE recent_searches SET created_at = now()
        WHERE id = (SELECT id FROM recent_searches
                     WHERE user_id = $1
                       AND type IS NOT DISTINCT FROM $2::text
                       AND category_id IS NOT DISTINCT FROM $3::text
                       AND keywords IS NOT DISTINCT FROM $4::text
                       AND neighborhood_id IS NOT DISTINCT FROM $5::text
                       AND latitude IS NOT DISTINCT FROM $6::numeric
                       AND longitude IS NOT DISTINCT FROM $7::numeric
                       AND radius_m IS NOT DISTINCT FROM $8::integer
                       AND period IS NOT DISTINCT FROM $9::text
                       AND date_from IS NOT DISTINCT FROM $10::date
                       AND date_to IS NOT DISTINCT FROM $11::date
                     LIMIT 1)
        RETURNING ${RECENT_COLUMNS}`,
      [userId, ...values]
    );
    if (r.rowCount === 0) {
      r = await c.query(
        `INSERT INTO recent_searches (user_id, type, category_id, keywords, neighborhood_id, latitude, longitude, radius_m, period, date_from, date_to)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING ${RECENT_COLUMNS}`,
        [userId, ...values]
      );
    }
    await c.query(
      `DELETE FROM recent_searches
        WHERE user_id = $1
          AND id NOT IN (SELECT id FROM recent_searches WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT ${MAX_RECENT})`,
      [userId]
    );
    return toRecentSearch(r.rows[0]);
  });
}

module.exports = {
  round3,
  haversineM,
  boundingBox,
  parseSearchFilters,
  parseRecentSearch,
  buildWhere,
  buildSearchQuery,
  toSearchItem,
  toRecentSearch,
  listCategories,
  search,
  listRecent,
  saveRecent,
  deleteRecent,
};
