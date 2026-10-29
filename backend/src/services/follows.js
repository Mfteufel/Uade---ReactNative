const { query } = require('../db');
const { HttpError } = require('../middleware/errors');

async function followPublication(userId, publicationId) {
  const r = await query('SELECT 1 FROM publications WHERE id = $1', [publicationId]);
  if (r.rowCount === 0) throw new HttpError(404, 'Publicación no encontrada.');
  // Seguirla dos veces no es un error: queda como estaba.
  await query(
    'INSERT INTO follows (user_id, publication_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, publicationId]
  );
}

async function unfollowPublication(userId, publicationId) {
  await query('DELETE FROM follows WHERE user_id = $1 AND publication_id = $2', [userId, publicationId]);
}

module.exports = { followPublication, unfollowPublication };
