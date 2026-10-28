const crypto = require('crypto');
const { query, withTransaction } = require('../db');
const { HttpError } = require('../middleware/errors');
const { FORBIDDEN_CHARS } = require('./profile');
const { photoUrl } = require('./photoUrl');

const MAX_ATTEMPTS = 3;
const MAX_ANSWER_LEN = 200;
const MAX_DESCRIPTION_LEN = 280;
const LIST_LIMIT = 100;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Funciones puras (se testean sin base de datos)
// ---------------------------------------------------------------------------

// "Es mío" solo existe sobre una publicación 'found' y "Lo encontré" sobre una 'lost' (lo asegura también la base).
const claimTypeFor = (publicationType) => (publicationType === 'found' ? 'mine' : 'found');

// Para comparar la respuesta de verificación sin importar mayúsculas, acentos, puntuación ni espacios de más.
// Es solo una ayuda para el publicador: la decisión final es suya.
function normalizeAnswer(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function answersMatch(given, correct) {
  const a = normalizeAnswer(given);
  return a !== '' && a === normalizeAnswer(correct);
}

const fail = (message) => ({ error: { status: 422, message } });

// Texto opcional u obligatorio. Devuelve { value } (null si venía vacío y era opcional) o { error }.
function cleanText(raw, { label, max, required }) {
  if (raw === undefined || raw === null || raw === '') {
    return required ? fail(`${label} es obligatoria.`) : { value: null };
  }
  if (typeof raw !== 'string') return fail(`${label} debe ser texto.`);
  const s = raw.trim();
  if (s === '') return required ? fail(`${label} es obligatoria.`) : { value: null };
  if (FORBIDDEN_CHARS.test(s)) return fail(`${label} tiene caracteres no permitidos.`);
  if (s.length > max) return fail(`${label} no puede superar los ${max} caracteres.`);
  return { value: s };
}

// Valida el body de un reclamo según el tipo de la publicación reclamada.
// Devuelve { input } con los campos limpios o { error: { status, message } }.
function buildClaimInput(publicationType, body) {
  if (body === undefined || body === null) body = {};
  if (typeof body !== 'object' || Array.isArray(body)) return fail('El cuerpo debe ser un objeto JSON.');
  const isMine = claimTypeFor(publicationType) === 'mine';

  const description = cleanText(body.description, { label: 'La descripción', max: MAX_DESCRIPTION_LEN, required: false });
  if (description.error) return description;

  let verificationAnswer = null;
  if (isMine) {
    const answer = cleanText(body.verificationAnswer, { label: 'La respuesta', max: MAX_ANSWER_LEN, required: true });
    if (answer.error) return answer;
    verificationAnswer = answer.value;
  }

  let photoId = null;
  if (body.photoId !== undefined && body.photoId !== null && body.photoId !== '') {
    if (typeof body.photoId !== 'string' || !UUID_RE.test(body.photoId)) return fail('La foto no es válida.');
    photoId = body.photoId.toLowerCase();
  } else if (!isMine) {
    return fail('Tenés que adjuntar una foto del objeto.');
  }

  let foundNeighborhoodId = null;
  if (!isMine) {
    const id = body.foundNeighborhoodId;
    if (typeof id !== 'string' || !ID_RE.test(id)) return fail('Elegí el barrio donde lo encontraste.');
    foundNeighborhoodId = id;
  }

  return {
    input: {
      type: claimTypeFor(publicationType),
      verificationAnswer,
      description: description.value,
      photoId,
      foundNeighborhoodId,
    },
  };
}

// Por qué esta persona no puede reclamar esta publicación ahora (o null si puede).
// `pub` trae user_id, status y vencida; `attempts` trae used (intentos hechos) y active (hay uno pendiente/aceptado).
function claimBlock({ pub, userId, attempts }) {
  if (pub.user_id === userId) return { status: 403, message: 'No podés reclamar tu propia publicación.' };
  if (pub.status !== 'open' || pub.vencida) {
    return { status: 409, message: 'Esta publicación ya no admite reclamos.' };
  }
  if (attempts.active) {
    return { status: 409, message: 'Ya tenés un reclamo pendiente o aceptado para esta publicación.' };
  }
  if (attempts.used >= MAX_ATTEMPTS) {
    return { status: 403, message: `Alcanzaste el máximo de ${MAX_ATTEMPTS} intentos para esta publicación.` };
  }
  return null;
}

// Arma lo que ve quien consulta el reclamo. Es la única función que decide qué datos salen según el rol:
//  - La respuesta correcta de la publicación nunca se incluye (ni siquiera para el publicador).
//  - La respuesta que escribió el solicitante y si coincide solo las ve el publicador.
//  - El teléfono de la otra parte solo sale con el reclamo aceptado y si esa persona lo dejó visible.
function toClaimView(row, userId) {
  const isClaimer = row.claimer_id === userId;
  const other = isClaimer
    ? { id: row.publisher_id, name: row.publisher_name, photo: row.publisher_photo_id, phone: row.publisher_phone, visible: row.publisher_phone_visible }
    : { id: row.claimer_id, name: row.claimer_name, photo: row.claimer_photo_id, phone: row.claimer_phone, visible: row.claimer_phone_visible };
  const showPhone = row.status === 'accepted' && other.visible && typeof other.phone === 'string' && other.phone.trim() !== '';

  const view = {
    id: row.id,
    role: isClaimer ? 'claimer' : 'publisher',
    type: row.type,
    status: row.status,
    attemptNumber: row.attempt_number,
    description: row.description,
    photoUri: photoUrl(row.photo_id),
    foundNeighborhood: row.found_neighborhood_id ? { id: row.found_neighborhood_id, name: row.found_neighborhood_name } : null,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    decidedAt: row.decided_at ? new Date(row.decided_at).toISOString() : null,
    publication: {
      id: row.publication_id,
      title: row.publication_title,
      type: row.publication_type,
      status: row.publication_status,
    },
    otherParty: { id: other.id, name: other.name, photoUri: photoUrl(other.photo), phone: showPhone ? other.phone : null },
  };
  if (!isClaimer && row.type === 'mine') {
    view.verificationAnswer = row.verification_answer;
    view.answerMatches = answersMatch(row.verification_answer, row.correct_answer);
  }
  return view;
}

// ---------------------------------------------------------------------------
// Acceso a datos
// ---------------------------------------------------------------------------

const newClaimId = () => 'c_' + crypto.randomBytes(12).toString('hex');

// Índices únicos de 005_claims.sql que cortan una carrera al crear o aceptar un reclamo.
const CREATE_RACE_CONSTRAINTS = ['claims_attempt_key', 'claims_one_active_per_claimer_idx'];
const ACCEPT_RACE_CONSTRAINT = 'claims_one_accepted_per_publication_idx';

const CLAIM_SELECT = `
  SELECT c.*,
         p.title AS publication_title, p.status AS publication_status,
         p.verification_answer AS correct_answer,
         pub.name AS publisher_name, pub.photo_id AS publisher_photo_id,
         pub.phone AS publisher_phone, pub.phone_visible_on_claim AS publisher_phone_visible,
         cl.name AS claimer_name, cl.photo_id AS claimer_photo_id,
         cl.phone AS claimer_phone, cl.phone_visible_on_claim AS claimer_phone_visible,
         n.name AS found_neighborhood_name
    FROM claims c
    JOIN publications p ON p.id = c.publication_id
    JOIN users pub ON pub.id = c.publisher_id
    JOIN users cl ON cl.id = c.claimer_id
    LEFT JOIN neighborhoods n ON n.id = c.found_neighborhood_id`;

// El vencimiento a las 48 h lo aplica el servidor con su propio reloj y las fechas guardadas en la base:
// no depende de que el solicitante tenga la app abierta ni del reloj del teléfono.
// Se llama antes de cada lectura o decisión y, además, desde un barrido periódico (ver index.js).
// SKIP LOCKED: si alguien está decidiendo justo ese reclamo, no esperamos ni nos trabamos con él.
async function expireDueClaims() {
  const r = await query(
    `WITH due AS (
       SELECT id FROM claims WHERE status = 'pending' AND expires_at <= now() ORDER BY id FOR UPDATE SKIP LOCKED
     )
     UPDATE claims SET status = 'expired', decided_at = now()
      WHERE id IN (SELECT id FROM due)`
  );
  return r.rowCount;
}

// Intentos de una persona sobre una publicación (cuenta todos los reclamos creados, incluso rechazados o vencidos).
async function getAttempts(client, publicationId, claimerId) {
  const r = await client.query(
    `SELECT COALESCE(MAX(attempt_number), 0)::int AS used,
            COALESCE(bool_or(status IN ('pending', 'accepted')), false) AS active
       FROM claims WHERE publication_id = $1 AND claimer_id = $2`,
    [publicationId, claimerId]
  );
  return r.rows[0];
}

const PUBLICATION_COLUMNS = `id, user_id, type, title, status, verification_question, (expires_at <= now()) AS vencida`;

async function loadClaimView(userId, claimId) {
  const r = await query(`${CLAIM_SELECT} WHERE c.id = $1 AND (c.claimer_id = $2 OR c.publisher_id = $2)`, [claimId, userId]);
  if (r.rowCount === 0) throw new HttpError(404, 'Reclamo no encontrado.');
  return toClaimView(r.rows[0], userId);
}

// Datos que necesita el formulario antes de enviar: qué tipo de reclamo corresponde, la pregunta de
// verificación (nunca la respuesta) y cuántos intentos quedan.
async function getClaimFormInfo(userId, publicationId) {
  await expireDueClaims();
  const r = await query(`SELECT ${PUBLICATION_COLUMNS} FROM publications WHERE id = $1`, [publicationId]);
  if (r.rowCount === 0) throw new HttpError(404, 'Publicación no encontrada.');
  const pub = r.rows[0];
  const attempts = await getAttempts({ query }, publicationId, userId);
  const block = claimBlock({ pub, userId, attempts });
  return {
    publicationId: pub.id,
    title: pub.title,
    type: pub.type,
    claimType: claimTypeFor(pub.type),
    verificationQuestion: pub.type === 'found' ? pub.verification_question : null,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts.used),
    canClaim: block === null,
    reason: block ? block.message : null,
  };
}

async function createClaim(userId, publicationId, body) {
  await expireDueClaims();
  const claimId = newClaimId();
  try {
    await withTransaction(async (c) => {
      // Bloquear la publicación hace que dos pedidos simultáneos del mismo usuario se atiendan de a uno:
      // el segundo ya ve el reclamo del primero y no puede pasar de 3 intentos ni tener dos activos.
      // El servidor valida el límite de 3 intentos para que no se supere enviando desde varios dispositivos a la vez.
      const r = await c.query(`SELECT ${PUBLICATION_COLUMNS} FROM publications WHERE id = $1 FOR UPDATE`, [publicationId]);
      if (r.rowCount === 0) throw new HttpError(404, 'Publicación no encontrada.');
      const pub = r.rows[0];

      const attempts = await getAttempts(c, publicationId, userId);
      const block = claimBlock({ pub, userId, attempts });
      if (block) throw new HttpError(block.status, block.message);

      const { input, error } = buildClaimInput(pub.type, body);
      if (error) throw new HttpError(error.status, error.message);

      if (input.photoId) {
        // La foto tiene que ser de quien reclama, haber sido subida como foto de reclamo y no estar usada en otro.
        // FOR UPDATE: mientras se crea el reclamo, el barrido de fotos sin usar (deleteOrphanClaimPhotos) la saltea.
        const photo = await c.query(
          `SELECT 1 FROM photos p
            WHERE p.id = $1 AND p.user_id = $2 AND p.kind = 'claim'
              AND NOT EXISTS (SELECT 1 FROM claims WHERE photo_id = p.id)
            FOR UPDATE OF p`,
          [input.photoId, userId]
        );
        if (photo.rowCount === 0) throw new HttpError(422, 'La foto no es válida. Subila de nuevo.');
      }
      if (input.foundNeighborhoodId) {
        const hood = await c.query('SELECT 1 FROM neighborhoods WHERE id = $1', [input.foundNeighborhoodId]);
        if (hood.rowCount === 0) throw new HttpError(422, 'Elegí un barrio de la lista.');
      }

      await c.query(
        `INSERT INTO claims (id, publication_id, publisher_id, publication_type, claimer_id, type, attempt_number,
                             verification_answer, description, photo_id, found_neighborhood_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now() + interval '48 hours')`,
        [claimId, publicationId, pub.user_id, pub.type, userId, input.type, attempts.used + 1,
         input.verificationAnswer, input.description, input.photoId, input.foundNeighborhoodId]
      );
    });
  } catch (e) {
    // Red de seguridad: los índices únicos de la base cortan cualquier carrera que se haya escapado.
    // Solo se traducen los que significan "ya hay un reclamo en curso"; cualquier otro choque es un error real.
    if (e && e.code === '23505' && CREATE_RACE_CONSTRAINTS.includes(e.constraint)) {
      throw new HttpError(409, 'Ya tenés un reclamo en curso para esta publicación. Revisá "Mis reclamos".');
    }
    throw e;
  }
  return loadClaimView(userId, claimId);
}

async function listClaims(userId, column) {
  await expireDueClaims();
  const r = await query(`${CLAIM_SELECT} WHERE c.${column} = $1 ORDER BY c.created_at DESC LIMIT ${LIST_LIMIT}`, [userId]);
  return r.rows.map((row) => toClaimView(row, userId));
}

const listSent = (userId) => listClaims(userId, 'claimer_id');
const listReceived = (userId) => listClaims(userId, 'publisher_id');

async function getClaim(userId, claimId) {
  await expireDueClaims();
  const view = await loadClaimView(userId, claimId);
  if (view.role === 'claimer') {
    const attempts = await getAttempts({ query }, view.publication.id, userId);
    view.attemptsLeft = Math.max(0, MAX_ATTEMPTS - attempts.used);
    view.maxAttempts = MAX_ATTEMPTS;
  }
  return view;
}

// Acepta o rechaza un reclamo. Solo el publicador, solo si sigue 'pending' y no venció.
async function decideClaim(userId, claimId, decision) {
  await expireDueClaims();
  try {
    await withTransaction(async (c) => {
      const first = await c.query('SELECT publication_id FROM claims WHERE id = $1', [claimId]);
      if (first.rowCount === 0) throw new HttpError(404, 'Reclamo no encontrado.');
      // Siempre se bloquea primero la publicación y después el reclamo (igual que createClaim) para no trabarse entre pedidos.
      await c.query('SELECT id FROM publications WHERE id = $1 FOR UPDATE', [first.rows[0].publication_id]);
      const r = await c.query(
        `SELECT c.id, c.publisher_id, c.claimer_id, c.status, c.publication_id,
                (c.expires_at <= now()) AS vencido, p.status AS publication_status
           FROM claims c JOIN publications p ON p.id = c.publication_id
          WHERE c.id = $1 FOR UPDATE OF c`,
        [claimId]
      );
      const claim = r.rows[0];
      // A quien no es parte del reclamo no se le revela que existe.
      if (!claim || (claim.publisher_id !== userId && claim.claimer_id !== userId)) {
        throw new HttpError(404, 'Reclamo no encontrado.');
      }
      if (claim.publisher_id !== userId) {
        throw new HttpError(403, 'Solo quien publicó puede aceptar o rechazar un reclamo.');
      }
      // El estado puede haber cambiado mientras la persona tenía la pantalla abierta: el servidor manda.
      if (claim.status === 'expired' || (claim.status === 'pending' && claim.vencido)) {
        throw new HttpError(409, 'Este reclamo venció: pasaron más de 48 horas sin respuesta.');
      }
      if (claim.status !== 'pending') {
        throw new HttpError(409, `Este reclamo ya fue ${claim.status === 'accepted' ? 'aceptado' : 'rechazado'}.`);
      }

      if (decision === 'accepted') {
        if (claim.publication_status !== 'open') {
          throw new HttpError(409, 'La publicación ya no está abierta, no se puede aceptar este reclamo.');
        }
        // Al aceptar, la publicación pasa a "en reclamo". Rechazar no la toca: sigue abierta.
        await c.query('UPDATE publications SET status = \'in_claim\', status_changed_at = now() WHERE id = $1', [claim.publication_id]);
        // La publicación ya no admite otro reclamo aceptado: los demás pendientes se rechazan en la misma
        // transacción. Así nadie queda viendo "Pendiente" durante 48 h ni recibe un 409 al intentar aceptarlos.
        // Siguen contando como intento de quien reclamó (el límite de 3 incluye los rechazados).
        await c.query(
          `UPDATE claims SET status = 'rejected', decided_at = now()
            WHERE publication_id = $1 AND status = 'pending' AND id <> $2`,
          [claim.publication_id, claimId]
        );
      }
      await c.query('UPDATE claims SET status = $2, decided_at = now() WHERE id = $1', [claimId, decision]);
    });
  } catch (e) {
    if (e && e.code === '23505' && e.constraint === ACCEPT_RACE_CONSTRAINT) {
      throw new HttpError(409, 'Esta publicación ya tiene un reclamo aceptado.');
    }
    throw e;
  }
  return loadClaimView(userId, claimId);
}

const acceptClaim = (userId, claimId) => decideClaim(userId, claimId, 'accepted');
const rejectClaim = (userId, claimId) => decideClaim(userId, claimId, 'rejected');

module.exports = {
  MAX_ATTEMPTS,
  claimTypeFor,
  normalizeAnswer,
  answersMatch,
  buildClaimInput,
  claimBlock,
  toClaimView,
  expireDueClaims,
  getClaimFormInfo,
  createClaim,
  listSent,
  listReceived,
  getClaim,
  acceptClaim,
  rejectClaim,
};
