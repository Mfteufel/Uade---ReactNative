const crypto = require('crypto');
const { query, withTransaction } = require('../db');
const { HttpError } = require('../middleware/errors');
const { FORBIDDEN_CHARS } = require('./profile');
const { photoUrl } = require('./photoUrl');
const { processAvatar } = require('./photos');

const MAX_PHOTOS = 5;
const MAX_TITLE_LEN = 80;
const MAX_DESCRIPTION_LEN = 500;
const MAX_ADDRESS_LEN = 200;
const MAX_VERIFICATION_LEN = 200;
const LIST_LIMIT = 100;
const ORPHAN_PHOTO_AGE = '24 hours';
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Variante de FORBIDDEN_CHARS que deja pasar el salto de línea (\n, \u000A); solo la usa la descripción.
const FORBIDDEN_CHARS_MULTILINE = /[\u0000-\u0009\u000B-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;

const fail = (message) => ({ error: { status: 422, message } });

function normalizeMultiline(raw) {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// missing: el mensaje si es obligatorio y viene vacío. Sin missing, el campo es opcional.
// multiline: permite saltos de línea (solo la descripción). Se normalizan \r\n y \r a \n, se recortan los espacios de
// cada línea y se colapsan 3 o más saltos seguidos en 2 (como mucho una línea en blanco). El largo cuenta el texto normalizado.
function cleanText(raw, { label, max, missing, multiline = false }) {
  const empty = () => (missing ? fail(missing) : { value: null });
  if (raw === undefined || raw === null || raw === '') return empty();
  if (typeof raw !== 'string') return fail(`${label} debe ser texto.`);
  const s = multiline ? normalizeMultiline(raw) : raw.trim();
  if (s === '') return empty();
  if ((multiline ? FORBIDDEN_CHARS_MULTILINE : FORBIDDEN_CHARS).test(s)) return fail(`${label} tiene caracteres no permitidos.`);
  if (s.length > max) return fail(`${label} no puede superar los ${max} caracteres.`);
  return { value: s };
}

// 'YYYY-MM-DD' que exista en el calendario. Se acepta hasta mañana por la diferencia de zona horaria con el celular.
function isValidPastDate(text, now = new Date()) {
  if (typeof text !== 'string' || !DATE_RE.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return false;
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return date <= tomorrow;
}

function cleanTime(raw, label) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  if (typeof raw !== 'string' || !TIME_RE.test(raw)) return fail(`${label} tiene que tener el formato HH:MM.`);
  return { value: raw };
}

function cleanCoordinate(raw, max) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : undefined;
}

function buildPublicationInput(body) {
  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
    return fail('El cuerpo debe ser un objeto JSON.');
  }

  if (typeof body.clientId !== 'string' || !UUID_RE.test(body.clientId)) return fail('Falta el identificador de la publicación.');
  if (body.type !== 'lost' && body.type !== 'found') return fail('Indicá si perdiste o encontraste algo.');

  const title = cleanText(body.title, { label: 'El título', max: MAX_TITLE_LEN, missing: 'Escribí un título.' });
  if (title.error) return title;
  const description = cleanText(body.description, { label: 'La descripción', max: MAX_DESCRIPTION_LEN, multiline: true });
  if (description.error) return description;

  if (typeof body.categoryId !== 'string' || !ID_RE.test(body.categoryId)) return fail('Elegí una categoría.');
  if (!isValidPastDate(body.occurredOn)) return fail('La fecha del suceso no es válida.');

  const timeFrom = cleanTime(body.timeFrom, 'La hora desde');
  if (timeFrom.error) return timeFrom;
  const timeTo = cleanTime(body.timeTo, 'La hora hasta');
  if (timeTo.error) return timeTo;
  if (timeFrom.value && timeTo.value && timeFrom.value > timeTo.value) {
    return fail('La hora desde no puede ser posterior a la hora hasta.');
  }

  if (typeof body.neighborhoodId !== 'string' || !ID_RE.test(body.neighborhoodId)) return fail('Elegí un barrio.');

  const latitude = cleanCoordinate(body.latitude, 90);
  const longitude = cleanCoordinate(body.longitude, 180);
  if (latitude === undefined || longitude === undefined) return fail('La ubicación no es válida.');
  if ((latitude === null) !== (longitude === null)) return fail('La ubicación no es válida.');

  const exactAddress = cleanText(body.exactAddress, { label: 'La dirección', max: MAX_ADDRESS_LEN });
  if (exactAddress.error) return exactAddress;
  if (!exactAddress.value && latitude === null) return fail('Escribí la dirección o usá tu ubicación actual.');

  // Solo lo encontrado lleva pregunta de verificación; en lo perdido se ignora.
  let verificationQuestion = null;
  let verificationAnswer = null;
  if (body.type === 'found') {
    const q = cleanText(body.verificationQuestion, { label: 'La pregunta de verificación', max: MAX_VERIFICATION_LEN, missing: 'Escribí la pregunta de verificación.' });
    if (q.error) return q;
    const a = cleanText(body.verificationAnswer, { label: 'La respuesta de verificación', max: MAX_VERIFICATION_LEN, missing: 'Escribí la respuesta a la pregunta de verificación.' });
    if (a.error) return a;
    verificationQuestion = q.value;
    verificationAnswer = a.value;
  }

  const rawPhotos = body.photoIds === undefined || body.photoIds === null ? [] : body.photoIds;
  if (!Array.isArray(rawPhotos)) return fail('Las fotos no son válidas.');
  if (rawPhotos.length > MAX_PHOTOS) return fail(`Podés subir hasta ${MAX_PHOTOS} fotos.`);
  if (!rawPhotos.every((id) => typeof id === 'string' && UUID_RE.test(id))) return fail('Las fotos no son válidas.');
  const photoIds = rawPhotos.map((id) => id.toLowerCase());
  if (new Set(photoIds).size !== photoIds.length) return fail('Hay fotos repetidas.');

  return {
    input: {
      clientId: body.clientId.toLowerCase(),
      type: body.type,
      title: title.value,
      description: description.value,
      categoryId: body.categoryId,
      occurredOn: body.occurredOn,
      timeFrom: timeFrom.value,
      timeTo: timeTo.value,
      neighborhoodId: body.neighborhoodId,
      exactAddress: exactAddress.value,
      latitude,
      longitude,
      verificationQuestion,
      verificationAnswer,
      photoIds,
    },
  };
}

// Vista para quien publicó: incluye la dirección y la respuesta, que nunca salen hacia otras personas.
function toOwnPublication(row) {
  const toNumber = (v) => (v === null || v === undefined ? null : Number(v));
  return {
    id: row.id,
    clientId: row.client_id,
    type: row.type,
    title: row.title,
    description: row.description,
    category: { id: row.category_id, name: row.category_name },
    occurredOn: row.occurred_on,
    timeFrom: row.time_from ? row.time_from.slice(0, 5) : null,
    timeTo: row.time_to ? row.time_to.slice(0, 5) : null,
    neighborhood: { id: row.neighborhood_id, name: row.neighborhood_name },
    exactAddress: row.exact_address,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    verificationQuestion: row.verification_question,
    verificationAnswer: row.verification_answer,
    status: row.status,
    expiresAt: new Date(row.expires_at).toISOString(),
    renewedAt: row.renewed_at ? new Date(row.renewed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    photoUrls: (row.photo_ids || []).map(photoUrl),
  };
}

const newPublicationId = () => 'p_' + crypto.randomBytes(12).toString('hex');

// occurred_on y time_* salen como texto para que pg no los convierta a Date con la zona horaria del server.
const OWN_SELECT = `
  SELECT p.id, p.client_id, p.type, p.title, p.description, p.category_id, c.name AS category_name,
         to_char(p.occurred_on, 'YYYY-MM-DD') AS occurred_on, p.time_from::text, p.time_to::text,
         p.neighborhood_id, n.name AS neighborhood_name, p.exact_address, p.latitude, p.longitude,
         p.verification_question, p.verification_answer, p.status, p.expires_at, p.renewed_at, p.created_at,
         ARRAY(SELECT pp.photo_id FROM publication_photos pp WHERE pp.publication_id = p.id ORDER BY pp.position) AS photo_ids
    FROM publications p
    JOIN categories c ON c.id = p.category_id
    JOIN neighborhoods n ON n.id = p.neighborhood_id`;

async function loadOwnPublication(client, userId, publicationId) {
  const r = await client.query(`${OWN_SELECT} WHERE p.id = $1 AND p.user_id = $2`, [publicationId, userId]);
  if (r.rowCount === 0) throw new HttpError(404, 'Publicación no encontrada.');
  return toOwnPublication(r.rows[0]);
}

// Vencen a los 30 días aunque nadie las toque: lo aplicamos antes de leer.
// Solo vencen las 'open': una 'in_claim' tiene un reclamo aceptado en curso (los pendientes no cambian el estado de la
// publicación) y no puede pasar a 'expired' mientras tanto. Mismo borde que el resto del backend: expires_at <= now().
async function expireDuePublications(client, userId) {
  await client.query(
    `UPDATE publications SET status = 'expired', status_changed_at = now()
      WHERE user_id = $1 AND status = 'open' AND expires_at <= now()`,
    [userId]
  );
}

// La foto se sube antes que la publicación (igual que en los reclamos) y después se asocia por su id.
async function savePublicationPhoto(userId, buf) {
  if (!buf) throw new HttpError(422, 'Elegí una foto para subir.');
  const jpeg = await processAvatar(buf);
  const ins = await query(
    `INSERT INTO photos (user_id, data, mime, kind) VALUES ($1, $2, 'image/jpeg', 'publication') RETURNING id`,
    [userId, jpeg]
  );
  return { photoId: ins.rows[0].id };
}

// Si se cortó la conexión al publicar, las fotos que ya se habían subido quedan sueltas
// (al reintentar se suben de nuevo). Se borran las que pasaron un día sin usarse.
async function deleteOrphanPublicationPhotos() {
  const r = await query(
    `DELETE FROM photos p
      WHERE p.kind = 'publication' AND p.created_at <= now() - interval '${ORPHAN_PHOTO_AGE}'
        AND NOT EXISTS (SELECT 1 FROM publication_photos pp WHERE pp.photo_id = p.id)`
  );
  return r.rowCount;
}

const FK_MESSAGES = {
  publications_category_id_fkey: 'Elegí una categoría válida.',
  publications_neighborhood_id_fkey: 'Elegí un barrio válido.',
};

// Devuelve { created, publication }. Si el clientId ya existe es un reintento del celular: devolvemos la que ya estaba.
async function createPublication(userId, body) {
  const { error, input } = buildPublicationInput(body);
  if (error) throw new HttpError(error.status, error.message);

  try {
    return await withTransaction(async (c) => {
      const ins = await c.query(
        `INSERT INTO publications (id, user_id, client_id, type, title, description, category_id, occurred_on,
                                   time_from, time_to, neighborhood_id, exact_address, latitude, longitude,
                                   verification_question, verification_answer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (user_id, client_id) DO NOTHING
         RETURNING id`,
        [
          newPublicationId(), userId, input.clientId, input.type, input.title, input.description, input.categoryId,
          input.occurredOn, input.timeFrom, input.timeTo, input.neighborhoodId, input.exactAddress,
          input.latitude, input.longitude, input.verificationQuestion, input.verificationAnswer,
        ]
      );

      if (ins.rowCount === 0) {
        const existing = await c.query('SELECT id FROM publications WHERE user_id = $1 AND client_id = $2', [userId, input.clientId]);
        return { created: false, publication: await loadOwnPublication(c, userId, existing.rows[0].id) };
      }

      const publicationId = ins.rows[0].id;
      if (input.photoIds.length > 0) {
        // Solo fotos de esta persona, subidas para publicar y que no estén usadas en otra publicación.
        const ok = await c.query(
          `SELECT id FROM photos ph
            WHERE ph.id = ANY($1::uuid[]) AND ph.user_id = $2 AND ph.kind = 'publication'
              AND NOT EXISTS (SELECT 1 FROM publication_photos pp WHERE pp.photo_id = ph.id)`,
          [input.photoIds, userId]
        );
        if (ok.rowCount !== input.photoIds.length) throw new HttpError(422, 'Alguna foto no es válida. Volvé a elegirlas.');
        for (const [position, photoId] of input.photoIds.entries()) {
          await c.query('INSERT INTO publication_photos (photo_id, publication_id, position) VALUES ($1, $2, $3)', [
            photoId, publicationId, position,
          ]);
        }
      }

      return { created: true, publication: await loadOwnPublication(c, userId, publicationId) };
    });
  } catch (e) {
    if (e.code === '23503' && FK_MESSAGES[e.constraint]) throw new HttpError(422, FK_MESSAGES[e.constraint]);
    throw e;
  }
}

async function listMine(userId) {
  return withTransaction(async (c) => {
    await expireDuePublications(c, userId);
    const r = await c.query(`${OWN_SELECT} WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT ${LIST_LIMIT}`, [userId]);
    return r.rows.map(toOwnPublication);
  });
}

// Renovar suma 30 días desde hoy. Si ya había vencido, vuelve a quedar abierta; salvo que tenga un reclamo aceptado
// (datos viejos, de cuando el barrido también vencía las 'in_claim'): entonces vuelve a 'in_claim'.
async function renewPublication(userId, publicationId) {
  return withTransaction(async (c) => {
    await expireDuePublications(c, userId);
    const r = await c.query('SELECT status FROM publications WHERE id = $1 AND user_id = $2 FOR UPDATE', [publicationId, userId]);
    if (r.rowCount === 0) throw new HttpError(404, 'Publicación no encontrada.');
    if (r.rows[0].status === 'resolved') throw new HttpError(409, 'Una publicación resuelta no se puede renovar.');
    let nextStatus = r.rows[0].status;
    if (nextStatus === 'expired') {
      const accepted = await c.query(`SELECT 1 FROM claims WHERE publication_id = $1 AND status = 'accepted' LIMIT 1`, [publicationId]);
      nextStatus = accepted.rowCount > 0 ? 'in_claim' : 'open';
    }
    await c.query(
      `UPDATE publications
          SET expires_at = now() + interval '30 days',
              renewed_at = now(),
              status_changed_at = CASE WHEN status <> $2 THEN now() ELSE status_changed_at END,
              status = $2
        WHERE id = $1`,
      [publicationId, nextStatus]
    );
    return loadOwnPublication(c, userId, publicationId);
  });
}

module.exports = {
  buildPublicationInput,
  normalizeMultiline,
  isValidPastDate,
  toOwnPublication,
  savePublicationPhoto,
  deleteOrphanPublicationPhotos,
  createPublication,
  listMine,
  renewPublication,
};
