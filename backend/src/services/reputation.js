const { query } = require('../db');
const { HttpError } = require('../middleware/errors');

// Pura. Forma del contrato (Reputation). Las insignias las calcula la app.
function computeReputation({ returns, positive, negative }) {
  const total = positive + negative;
  return {
    points: Math.max(0, returns * 10 + positive * 2 - negative * 5),
    completedReturns: returns,
    positiveRatings: positive,
    negativeRatings: negative,
    positivePercent: total ? Math.round((positive * 100) / total) : null,
  };
}

// Una sola consulta agregada (solo lectura). Devuelve null si el usuario no existe.
async function getReputationCounts(userId) {
  const r = await query(
    `SELECT
       (SELECT count(*) FROM returns WHERE user_id = u.id)::int AS returns,
       (SELECT count(*) FROM ratings WHERE rated_user_id = u.id AND positive)::int AS positive,
       (SELECT count(*) FROM ratings WHERE rated_user_id = u.id AND NOT positive)::int AS negative
     FROM users u WHERE u.id = $1`,
    [userId]
  );
  return r.rowCount === 0 ? null : r.rows[0];
}

async function getReputation(userId) {
  const counts = await getReputationCounts(userId);
  if (!counts) throw new HttpError(404, 'Usuario no encontrado.');
  return computeReputation(counts);
}

module.exports = { computeReputation, getReputationCounts, getReputation };
