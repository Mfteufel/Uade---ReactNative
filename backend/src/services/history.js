const { query } = require('../db');
const { HttpError } = require('../middleware/errors');
const { photoUrl } = require('./photoUrl');

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const INT_RE = /^\d+$/;
const ROLES = ['devolvi', 'recupere'];
const TYPES = ['lost', 'found']; // tipo de la publicación, igual que `tipo` en GET /publicaciones
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_PAGE = 1000;
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // plazo para valorar y agradecer: 7 días desde returns.created_at

// ---------------------------------------------------------------------------
// Funciones puras (se testean sin base de datos)
// ---------------------------------------------------------------------------

const fail = (message) => ({ error: { status: 422, message } });

const isValidDate = (s) => {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

// Lee un parámetro opcional de texto: devuelve { value } (undefined si no vino) o { error }.
function readText(raw, key) {
  const v = raw[key];
  if (v === undefined || v === null || v === '') return { value: undefined };
  if (typeof v === 'number') return { value: String(v) };
  if (typeof v !== 'string') return fail(`El parámetro ${key} no es válido.`);
  const s = v.trim();
  return { value: s === '' ? undefined : s };
}

// Día de Buenos Aires (UTC−3 fijo, igual que la búsqueda) -> instante UTC en que empieza ese día.
const startOfDayBA = (ymd) => new Date(`${ymd}T00:00:00-03:00`);

// Valida el query string de GET /historial. Devuelve { filters } o { error: { status, message } }.
// rango: desde inclusive y hasta inclusive, como días de Buenos Aires -> [from, to) en instantes UTC.
function parseHistoryFilters(raw) {
  if (raw === undefined || raw === null) raw = {};
  if (typeof raw !== 'object' || Array.isArray(raw)) return fail('Los parámetros no son válidos.');

  const text = {};
  for (const key of ['rol', 'desde', 'hasta', 'tipo', 'categoria', 'pagina', 'limite']) {
    const r = readText(raw, key);
    if (r.error) return r;
    text[key] = r.value;
  }

  let rol = null;
  if (text.rol !== undefined) {
    if (!ROLES.includes(text.rol)) return fail('El rol tiene que ser devolvi o recupere.');
    rol = text.rol;
  }

  for (const key of ['desde', 'hasta']) {
    if (text[key] !== undefined && !isValidDate(text[key])) return fail(`La fecha ${key} tiene que tener el formato AAAA-MM-DD.`);
  }
  if (text.desde && text.hasta && text.desde > text.hasta) return fail('La fecha desde no puede ser posterior a hasta.');
  const from = text.desde ? startOfDayBA(text.desde) : null;
  const to = text.hasta ? new Date(startOfDayBA(text.hasta).getTime() + 24 * 60 * 60 * 1000) : null;

  let tipo = null;
  if (text.tipo !== undefined) {
    if (!TYPES.includes(text.tipo)) return fail('El tipo no es válido.');
    tipo = text.tipo;
  }

  let categoria = null;
  if (text.categoria !== undefined) {
    if (!ID_RE.test(text.categoria)) return fail('La categoría no es válida.');
    categoria = text.categoria;
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

  return { filters: { rol, from, to, tipo, categoria, page, limit } };
}

// ¿Sigue abierto el plazo de 7 días? El borde es inclusivo: a los 7 días exactos todavía se puede.
function withinWindow(createdAt, now) {
  const age = new Date(now).getTime() - new Date(createdAt).getTime();
  return age >= 0 && age <= WINDOW_MS;
}

// Se puede valorar si hay contraparte, sigue el plazo y todavía no valoré esta devolución.
function computeCanRate({ createdAt, now, hasCounterpart, alreadyRated }) {
  return Boolean(hasCounterpart) && !alreadyRated && withinWindow(createdAt, now);
}

// Solo agradece quien recuperó, dentro del plazo y si nadie agradeció antes (hay un agradecimiento por devolución).
function computeCanThank({ role, createdAt, now, alreadyThanked }) {
  return role === 'recupere' && !alreadyThanked && withinWindow(createdAt, now);
}

const iso = (d) => (d instanceof Date ? d.toISOString() : d);

// Fila de la base -> item de la respuesta. La contraparte nunca lleva teléfono ni email.
// La consulta ya excluye las devoluciones sin reclamo o sin quien recuperó; si igual falta un dato
// (por ejemplo, la publicación se borró), object o counterpart salen en null: no se inventa nada.
function toHistoryItem(row, now = new Date()) {
  const createdAt = iso(row.created_at);
  const rated = row.rating_positive !== null && row.rating_positive !== undefined;
  const thanked = row.thanks_id !== null && row.thanks_id !== undefined;
  return {
    id: Number(row.id), // número, igual que el resto de la API de devoluciones (pg devuelve bigint como texto)
    role: row.role,
    date: createdAt,
    object: row.publication_title === null || row.publication_title === undefined
      ? null
      : {
          title: row.publication_title,
          type: row.publication_type ?? null,
          category: row.category_id ? { id: row.category_id, name: row.category_name } : null,
        },
    counterpart: row.counterpart_id
      ? { id: row.counterpart_id, name: row.counterpart_name, photoUri: photoUrl(row.counterpart_photo_id) }
      : null,
    canRate: computeCanRate({ createdAt, now, hasCounterpart: Boolean(row.counterpart_id), alreadyRated: rated }),
    myRating: rated ? { positive: row.rating_positive, comment: row.rating_comment ?? null } : null,
    canThank: computeCanThank({ role: row.role, createdAt, now, alreadyThanked: thanked }),
    thanked,
  };
}

// Consulta de solo lectura. $1 es siempre el usuario.
// Se excluyen las devoluciones sin reclamo o sin quien recuperó (datos viejos del seed, sin objeto ni contraparte).
function buildHistoryQuery(filters, userId) {
  const params = [userId];
  const add = (v) => { params.push(v); return `$${params.length}`; };
  const who = {
    devolvi: 'r.user_id = $1',
    recupere: 'r.recovered_by_id = $1',
  };
  const clauses = [
    filters.rol ? who[filters.rol] : '(r.user_id = $1 OR r.recovered_by_id = $1)',
    'r.claim_id IS NOT NULL',
    'r.recovered_by_id IS NOT NULL',
  ];
  if (filters.from) clauses.push(`r.created_at >= ${add(filters.from)}`);
  if (filters.to) clauses.push(`r.created_at < ${add(filters.to)}`);
  if (filters.tipo) clauses.push(`p.type = ${add(filters.tipo)}`);
  if (filters.categoria) clauses.push(`p.category_id = ${add(filters.categoria)}`);
  const limitP = add(filters.limit + 1);
  const offsetP = add((filters.page - 1) * filters.limit);
  const text = `SELECT r.id, r.created_at,
       CASE WHEN r.user_id = $1 THEN 'devolvi' ELSE 'recupere' END AS role,
       p.title AS publication_title, p.type AS publication_type, p.category_id, c.name AS category_name,
       u.id AS counterpart_id, u.name AS counterpart_name, u.photo_id AS counterpart_photo_id,
       rt.positive AS rating_positive, rt.comment AS rating_comment,
       th.id AS thanks_id
  FROM returns r
  LEFT JOIN claims cl ON cl.id = r.claim_id
  LEFT JOIN publications p ON p.id = cl.publication_id
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN users u ON u.id = CASE WHEN r.user_id = $1 THEN r.recovered_by_id ELSE r.user_id END
  LEFT JOIN ratings rt ON rt.return_id = r.id AND rt.author_id = $1
  LEFT JOIN thanks th ON th.return_id = r.id
 WHERE ${clauses.join('\n   AND ')}
 ORDER BY r.created_at DESC, r.id DESC
 LIMIT ${limitP} OFFSET ${offsetP}`;
  return { text, params };
}

// ---------------------------------------------------------------------------
// Con base de datos
// ---------------------------------------------------------------------------

async function getHistory(userId, rawQuery) {
  const parsed = parseHistoryFilters(rawQuery);
  if (parsed.error) {
    throw new HttpError(parsed.error.status, parsed.error.message);
  }
  const { filters } = parsed;
  const q = buildHistoryQuery(filters, userId);
  const r = await query(q.text, q.params);
  const hasMore = r.rows.length > filters.limit;
  const now = new Date();
  return {
    items: r.rows.slice(0, filters.limit).map((row) => toHistoryItem(row, now)),
    page: filters.page,
    limit: filters.limit,
    hasMore,
  };
}

module.exports = {
  WINDOW_MS,
  parseHistoryFilters,
  withinWindow,
  computeCanRate,
  computeCanThank,
  toHistoryItem,
  buildHistoryQuery,
  getHistory,
};
