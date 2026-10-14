const { query } = require('../db');
const { HttpError } = require('../middleware/errors');
const { computeReputation, getReputationCounts } = require('./reputation');

// Pura. Lista blanca exacta del contrato: se arma campo por campo.
function toPublicProfile(row, reputation) {
  return {
    id: row.id,
    name: row.name,
    photoUri: null, // Fase 7
    memberSince: new Date(row.created_at).toISOString(),
    reputation,
  };
}

async function getPublicProfile(id) {
  const r = await query('SELECT id, name, created_at FROM users WHERE id = $1', [id]);
  if (r.rowCount === 0) throw new HttpError(404, 'Usuario no encontrado.');
  const counts = await getReputationCounts(id);
  if (!counts) throw new HttpError(404, 'Usuario no encontrado.');
  return toPublicProfile(r.rows[0], computeReputation(counts));
}

module.exports = { toPublicProfile, getPublicProfile };
