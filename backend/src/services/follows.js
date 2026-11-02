const { query } = require('../db');
const { HttpError } = require('../middleware/errors');
const { photoUrl } = require('./photoUrl');

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

// Publicaciones que sigue la persona, primero las que tienen novedad.
// Novedad: cambió de estado desde la última vez que la vio. Si está vencida, vale la fecha real de vencimiento:
// el estado puede actualizarse días después, recién cuando el dueño abre "Mis publicaciones".
async function listFollows(userId) {
  const r = await query(
    `SELECT p.id, p.type, p.title,
            CASE WHEN p.status = 'open' AND p.expires_at <= now() THEN 'expired'
                 ELSE p.status END AS status,
            p.category_id, c.name AS category_name,
            p.neighborhood_id, n.name AS neighborhood_name,
            to_char(p.occurred_on, 'YYYY-MM-DD') AS occurred_on,
            (SELECT pp.photo_id FROM publication_photos pp
              WHERE pp.publication_id = p.id ORDER BY pp.position LIMIT 1) AS photo_id,
            CASE WHEN p.status = 'expired' OR (p.status = 'open' AND p.expires_at <= now())
                 THEN p.expires_at > f.seen_at
                 ELSE p.status_changed_at > f.seen_at END AS has_news
       FROM follows f
       JOIN publications p ON p.id = f.publication_id
       JOIN categories c ON c.id = p.category_id
       JOIN neighborhoods n ON n.id = p.neighborhood_id
      WHERE f.user_id = $1
      ORDER BY has_news DESC, f.created_at DESC`,
    [userId]
  );
  return r.rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    category: { id: row.category_id, name: row.category_name },
    neighborhood: { id: row.neighborhood_id, name: row.neighborhood_name },
    occurredOn: row.occurred_on,
    photoUrl: row.photo_id ? photoUrl(row.photo_id) : null,
    tieneNovedad: row.has_news,
  }));
}

// La persona vio el estado actual: la novedad se apaga hasta el próximo cambio.
async function markFollowSeen(userId, publicationId) {
  const r = await query('UPDATE follows SET seen_at = now() WHERE user_id = $1 AND publication_id = $2', [
    userId,
    publicationId,
  ]);
  if (r.rowCount === 0) throw new HttpError(404, 'No seguís esta publicación.');
}

module.exports = { followPublication, unfollowPublication, listFollows, markFollowSeen };
