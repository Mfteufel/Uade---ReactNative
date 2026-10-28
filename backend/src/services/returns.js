const { query } = require('../db');
const { HttpError } = require('../middleware/errors');
const { FORBIDDEN_CHARS } = require('./profile');
const { withinWindow } = require('./history');

const RETURN_ID_RE = /^[1-9]\d{0,17}$/; // returns.id es bigint: hasta 18 dígitos entra siempre
const MAX_COMMENT_LEN = 280;
const NOT_FOUND = 'Devolución no encontrada.';
const RATING_RACE_CONSTRAINT = 'ratings_return_author_key';

// ---------------------------------------------------------------------------
// Funciones puras (se testean sin base de datos)
// ---------------------------------------------------------------------------

const fail = (status, message) => ({ error: { status, message } });

const isValidReturnId = (id) => typeof id === 'string' && RETURN_ID_RE.test(id);

// Valida el body de POST /devoluciones/:id/valoraciones. Devuelve { rating: { positive, comment } } o { error }.
// comment: se recortan los espacios; vacío -> null. El largo se cuenta en caracteres, igual que char_length de la base.
function parseRatingBody(raw) {
  if (raw === undefined || raw === null) raw = {};
  if (typeof raw !== 'object' || Array.isArray(raw)) return fail(422, 'El cuerpo debe ser un objeto JSON.');
  if (typeof raw.positive !== 'boolean') return fail(422, 'Indicá si la valoración es positiva o negativa (positive: true o false).');

  let comment = null;
  if (raw.comment !== undefined && raw.comment !== null) {
    if (typeof raw.comment !== 'string') return fail(422, 'El comentario tiene que ser texto.');
    const s = raw.comment.trim();
    if (FORBIDDEN_CHARS.test(s)) return fail(422, 'El comentario tiene caracteres no permitidos.');
    if ([...s].length > MAX_COMMENT_LEN) return fail(422, `El comentario no puede superar los ${MAX_COMMENT_LEN} caracteres.`);
    comment = s === '' ? null : s;
  }
  return { rating: { positive: raw.positive, comment } };
}

// La otra parte de la devolución para userId, o null si userId no es parte o no hay quien recuperó.
function counterpartOf(ret, userId) {
  if (!ret) return null;
  if (ret.user_id === userId) return ret.recovered_by_id || null;
  if (ret.recovered_by_id === userId) return ret.user_id;
  return null;
}

const isParty = (ret, userId) => Boolean(ret) && (ret.user_id === userId || ret.recovered_by_id === userId);

// Reglas para valorar, en este orden. Devuelve null si se puede, o { status, message }.
// Quien no es parte recibe el mismo 404 que si la devolución no existiera.
function checkCanRate({ ret, userId, now, alreadyRated }) {
  if (!ret || !isParty(ret, userId)) return { status: 404, message: NOT_FOUND };
  if (!ret.recovered_by_id) return { status: 422, message: 'Esta devolución no tiene a quién valorar.' };
  if (!withinWindow(ret.created_at, now)) return { status: 422, message: 'El plazo para valorar venció (7 días desde la devolución).' };
  if (alreadyRated) return { status: 409, message: 'Ya valoraste esta devolución.' };
  return null;
}

const iso = (d) => (d instanceof Date ? d.toISOString() : d);

function toRating(row) {
  return {
    id: String(row.id),
    returnId: String(row.return_id),
    ratedUserId: row.rated_user_id,
    positive: row.positive,
    comment: row.comment ?? null,
    createdAt: iso(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// Con base de datos
// ---------------------------------------------------------------------------

async function rateReturn(userId, returnId, body) {
  if (!isValidReturnId(returnId)) throw new HttpError(404, NOT_FOUND);
  const parsed = parseRatingBody(body);
  if (parsed.error) throw new HttpError(parsed.error.status, parsed.error.message);
  const { positive, comment } = parsed.rating;

  const r = await query(
    `SELECT r.id, r.user_id, r.recovered_by_id, r.created_at,
            EXISTS (SELECT 1 FROM ratings rt WHERE rt.return_id = r.id AND rt.author_id = $2) AS already_rated
       FROM returns r
      WHERE r.id = $1`,
    [returnId, userId]
  );
  const ret = r.rows[0] || null;
  const problem = checkCanRate({ ret, userId, now: new Date(), alreadyRated: Boolean(ret && ret.already_rated) });
  if (problem) throw new HttpError(problem.status, problem.message);

  try {
    const ins = await query(
      `INSERT INTO ratings (rated_user_id, author_id, positive, comment, return_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, return_id, rated_user_id, positive, comment, created_at`,
      [counterpartOf(ret, userId), userId, positive, comment, ret.id]
    );
    return toRating(ins.rows[0]);
  } catch (e) {
    // Dos pedidos simultáneos: el segundo choca con UNIQUE (return_id, author_id).
    if (e && e.code === '23505' && e.constraint === RATING_RACE_CONSTRAINT) throw new HttpError(409, 'Ya valoraste esta devolución.');
    throw e;
  }
}

module.exports = {
  MAX_COMMENT_LEN,
  isValidReturnId,
  parseRatingBody,
  counterpartOf,
  checkCanRate,
  toRating,
  rateReturn,
};
