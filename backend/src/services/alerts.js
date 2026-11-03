const crypto = require('crypto');
const { query, withTransaction } = require('../db');
const { HttpError } = require('../middleware/errors');
const { parseRecentSearch } = require('./search');

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_ALERTS = 20;

// Una búsqueda siempre tiene tipo, pero en la base una alerta puede no tenerlo (datos de ejemplo). Se trata como
// "found": la app la abre como "Perdí", y así el contador coincide con lo que se ve en los resultados.
const ALERT_TYPE_SQL = "COALESCE(a.publication_type, 'found')";

const newAlertId = () => 'a_' + crypto.randomBytes(12).toString('hex');

// Publicaciones nuevas de la alerta: creadas después de la última vez que se miró, con sus criterios.
// Mismas reglas que la búsqueda (services/search.js): vigentes, de otra persona y palabras clave por texto completo.
const NEW_COUNT_SQL = `(SELECT count(*)::int FROM publications p
   WHERE p.status IN ('open', 'in_claim') AND p.expires_at > now()
     AND p.user_id <> a.user_id
     AND p.created_at > a.last_seen_at
     AND p.type = ${ALERT_TYPE_SQL}
     AND (a.category_id IS NULL OR p.category_id = a.category_id)
     AND (a.neighborhood_id IS NULL OR p.neighborhood_id = a.neighborhood_id)
     AND (a.keywords IS NULL OR numnode(plainto_tsquery('spanish', a.keywords)) = 0
          OR p.search_tsv @@ plainto_tsquery('spanish', a.keywords)))`;

// Una alerta pausada no cuenta novedades.
const ALERT_SELECT = `SELECT a.id, ${ALERT_TYPE_SQL} AS publication_type, a.category_id, c.name AS category_name,
       a.neighborhood_id, n.name AS neighborhood_name, a.keywords, a.paused, a.created_at,
       CASE WHEN a.paused THEN 0 ELSE ${NEW_COUNT_SQL} END AS new_count
  FROM alerts a
  LEFT JOIN categories c ON c.id = a.category_id
  LEFT JOIN neighborhoods n ON n.id = a.neighborhood_id`;

// Fila de la base -> alerta con los nombres que usa la búsqueda (tipo, categoria, q, barrio).
function toAlert(row) {
  return {
    id: row.id,
    tipo: row.publication_type,
    categoria: row.category_id ? { id: row.category_id, name: row.category_name } : null,
    barrio: row.neighborhood_id ? { id: row.neighborhood_id, name: row.neighborhood_name } : null,
    q: row.keywords,
    pausada: row.paused,
    cantidadNuevas: row.new_count,
    createdAt: row.created_at,
  };
}

// Si el id no tiene formato válido, no existe o la alerta es de otra persona: 404 (no se distingue).
function validAlertId(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new HttpError(404, 'Alerta no encontrada.');
  return id;
}

async function listAlerts(userId) {
  const r = await query(`${ALERT_SELECT} WHERE a.user_id = $1 ORDER BY a.created_at DESC, a.id DESC`, [userId]);
  return r.rows.map(toAlert);
}

// Guarda una búsqueda como alerta. De la búsqueda solo se guardan tipo, categoría, palabras clave y barrio.
async function createAlert(userId, body) {
  const raw = body && typeof body === 'object' ? body : {};
  // Se validan igual que los criterios de una búsqueda reciente.
  const parsed = parseRecentSearch({ tipo: raw.tipo, categoria: raw.categoria, q: raw.q, barrio: raw.barrio });
  if (parsed.error) throw new HttpError(parsed.error.status, parsed.error.message);
  const { tipo, categoria, q, barrio } = parsed.filters;

  if (categoria) {
    const c = await query('SELECT 1 FROM categories WHERE id = $1', [categoria]);
    if (c.rowCount === 0) throw new HttpError(422, 'La categoría no existe.');
  }
  if (barrio) {
    const n = await query('SELECT 1 FROM neighborhoods WHERE id = $1', [barrio]);
    if (n.rowCount === 0) throw new HttpError(422, 'El barrio no existe.');
  }

  const id = newAlertId();
  await withTransaction(async (c) => {
    // FOR UPDATE: dos pedidos simultáneos de la misma persona pasan de a uno por estos controles.
    await c.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);

    const same = await c.query(
      `SELECT 1 FROM alerts
        WHERE user_id = $1 AND publication_type IS NOT DISTINCT FROM $2 AND category_id IS NOT DISTINCT FROM $3
          AND keywords IS NOT DISTINCT FROM $4 AND neighborhood_id IS NOT DISTINCT FROM $5`,
      [userId, tipo, categoria, q, barrio]
    );
    if (same.rowCount > 0) throw new HttpError(409, 'Ya tenés una alerta con esta búsqueda.');

    const total = await c.query('SELECT count(*)::int AS n FROM alerts WHERE user_id = $1', [userId]);
    if (total.rows[0].n >= MAX_ALERTS) {
      throw new HttpError(422, `Podés tener hasta ${MAX_ALERTS} alertas. Eliminá alguna para guardar otra.`);
    }

    await c.query(
      `INSERT INTO alerts (id, user_id, publication_type, category_id, keywords, neighborhood_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, userId, tipo, categoria, q, barrio]
    );
  });
  const r = await query(`${ALERT_SELECT} WHERE a.id = $1`, [id]);
  return toAlert(r.rows[0]);
}

async function setAlertPaused(userId, id, body) {
  const pausada = body?.pausada;
  if (typeof pausada !== 'boolean') throw new HttpError(422, 'Indicá pausada: true o false.');
  const r = await query('UPDATE alerts SET paused = $3 WHERE id = $1 AND user_id = $2', [validAlertId(id), userId, pausada]);
  if (r.rowCount === 0) throw new HttpError(404, 'Alerta no encontrada.');
}

async function deleteAlert(userId, id) {
  const r = await query('DELETE FROM alerts WHERE id = $1 AND user_id = $2', [validAlertId(id), userId]);
  if (r.rowCount === 0) throw new HttpError(404, 'Alerta no encontrada.');
}

// La persona ya vio las nuevas: desde ahora cuentan solo las que se publiquen después.
async function markAlertSeen(userId, id) {
  const r = await query('UPDATE alerts SET last_seen_at = now() WHERE id = $1 AND user_id = $2', [validAlertId(id), userId]);
  if (r.rowCount === 0) throw new HttpError(404, 'Alerta no encontrada.');
}

module.exports = { listAlerts, createAlert, setAlertPaused, deleteAlert, markAlertSeen };
