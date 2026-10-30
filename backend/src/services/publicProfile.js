const { query } = require('../db');
const { HttpError } = require('../middleware/errors');
const { photoUrl } = require('./photoUrl');
const { computeReputation, getReputationCounts } = require('./reputation');

const MAX_THANKS = 20;

// Pura. Un agradecimiento recibido, campo por campo: sin ids, sin datos de contacto ni del objeto.
function toPublicThanks(row) {
  return {
    message: row.message,
    createdAt: new Date(row.created_at).toISOString(),
    author: { name: row.name, photoUri: photoUrl(row.photo_id) },
  };
}

// Pura. Lista blanca exacta del contrato: se arma campo por campo.
// thanks solo se agrega si se pidió (array de filas de thanks + autor); si no, el campo no existe.
function toPublicProfile(row, reputation, thanksRows) {
  const out = {
    id: row.id,
    name: row.name,
    photoUri: photoUrl(row.photo_id),
    memberSince: new Date(row.created_at).toISOString(),
    reputation,
  };
  if (thanksRows !== undefined) out.thanks = thanksRows.map(toPublicThanks);
  return out;
}

// Últimos agradecimientos recibidos (los deja quien recuperó, para quien devolvió).
async function getReceivedThanks(id) {
  const r = await query(
    `SELECT t.message, t.created_at, u.name, u.photo_id
       FROM thanks t
       JOIN users u ON u.id = t.author_id
      WHERE t.recipient_id = $1
      ORDER BY t.created_at DESC
      LIMIT ${MAX_THANKS}`,
    [id]
  );
  return r.rows;
}

// withThanks: solo GET /users/:id/public lo pide. Por defecto no hace la consulta ni agrega el campo.
async function getPublicProfile(id, { withThanks = false } = {}) {
  const r = await query('SELECT id, name, photo_id, created_at FROM users WHERE id = $1', [id]);
  if (r.rowCount === 0) throw new HttpError(404, 'Usuario no encontrado.');
  const counts = await getReputationCounts(id);
  if (!counts) throw new HttpError(404, 'Usuario no encontrado.');
  const thanksRows = withThanks ? await getReceivedThanks(id) : undefined;
  return toPublicProfile(r.rows[0], computeReputation(counts), thanksRows);
}

module.exports = { MAX_THANKS, toPublicThanks, toPublicProfile, getPublicProfile };
