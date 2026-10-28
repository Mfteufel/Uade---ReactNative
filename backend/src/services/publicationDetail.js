const { query } = require('../db');
const { HttpError } = require('../middleware/errors');
const { photoUrl } = require('./photoUrl');
const { getPublicProfile } = require('./publicProfile');

async function getPublicationDetail(id, viewerId) {
  const r = await query(
    `SELECT p.id, p.user_id, p.type, p.title, p.description,
            -- Si ya pasó el vencimiento y nadie actualizó el estado, se muestra vencida.
            CASE WHEN p.status IN ('open', 'in_claim') AND p.expires_at < now() THEN 'expired'
                 ELSE p.status END AS status,
            p.category_id, c.name AS category_name,
            p.neighborhood_id, n.name AS neighborhood_name,
            to_char(p.occurred_on, 'YYYY-MM-DD') AS occurred_on,
            to_char(p.time_from, 'HH24:MI') AS time_from,
            to_char(p.time_to, 'HH24:MI') AS time_to,
            -- La dirección exacta solo la ve el dueño o quien tiene un reclamo aceptado.
            CASE WHEN p.user_id = $2
                   OR EXISTS (SELECT 1 FROM claims cl
                               WHERE cl.publication_id = p.id AND cl.claimer_id = $2 AND cl.status = 'accepted')
                 THEN p.exact_address END AS exact_address
       FROM publications p
       JOIN categories c ON c.id = p.category_id
       JOIN neighborhoods n ON n.id = p.neighborhood_id
      WHERE p.id = $1`,
    [id, viewerId]
  );
  if (r.rowCount === 0) throw new HttpError(404, 'Publicación no encontrada.');
  const row = r.rows[0];

  const photos = await query(
    'SELECT photo_id FROM publication_photos WHERE publication_id = $1 ORDER BY position',
    [id]
  );

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    status: row.status,
    category: { id: row.category_id, name: row.category_name },
    neighborhood: { id: row.neighborhood_id, name: row.neighborhood_name },
    occurredOn: row.occurred_on,
    timeFrom: row.time_from,
    timeTo: row.time_to,
    exactAddress: row.exact_address,
    photoUrls: photos.rows.map((photo) => photoUrl(photo.photo_id)),
    publisher: await getPublicProfile(row.user_id),
  };
}

module.exports = { getPublicationDetail };
