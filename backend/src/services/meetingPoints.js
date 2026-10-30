const crypto = require('crypto');
const { query, withTransaction } = require('../db');
const { HttpError } = require('../middleware/errors');
const { cleanText } = require('./claims');

const MAX_ADDRESS_LEN = 200;
const MAX_NOTES_LEN = 280;

// ---------------------------------------------------------------------------
// Funciones puras (se testean sin base de datos)
// ---------------------------------------------------------------------------

// Quién tiene físicamente el objeto: en una publicación "encontrada" el publicador;
// en una "perdida" quien reclamó "Lo encontré". Es quien propone el primer lugar.
const holderIdOf = (claim) => (claim.publication_type === 'found' ? claim.publisher_id : claim.claimer_id);

// Quién recupera el objeto: la otra parte. Es quien confirma que la devolución se concretó.
const recoveredIdOf = (claim) => (holderIdOf(claim) === claim.publisher_id ? claim.claimer_id : claim.publisher_id);

// Valida el body de una propuesta. Devuelve { input } o { error: { status, message } }.
function buildMeetingInput(body) {
  if (body === undefined || body === null) body = {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    return { error: { status: 422, message: 'El cuerpo debe ser un objeto JSON.' } };
  }
  const address = cleanText(body.address, { label: 'La dirección', max: MAX_ADDRESS_LEN, required: true });
  if (address.error) return address;
  const notes = cleanText(body.notes, { label: 'La aclaración', max: MAX_NOTES_LEN, required: false });
  if (notes.error) return notes;
  return { input: { address: address.value, notes: notes.value } };
}

// Qué puede hacer esta persona ahora con el punto vigente (o sin ninguno).
// `status` es el código HTTP que corresponde si intenta proponer sin poder; la base no asegura estas reglas.
function meetingActions({ claim, current, userId }) {
  if (!current) {
    if (userId === holderIdOf(claim)) return { canPropose: true, canAccept: false, reason: null, status: null };
    return {
      canPropose: false,
      canAccept: false,
      reason: 'Todavía no hay un lugar propuesto. Lo propone quien tiene el objeto.',
      status: 403,
    };
  }
  if (current.status === 'accepted') {
    return { canPropose: false, canAccept: false, reason: 'El punto de encuentro ya fue acordado.', status: 409 };
  }
  if (current.proposed_by === userId) {
    return { canPropose: false, canAccept: false, reason: 'Esperando la respuesta de la otra persona.', status: 409 };
  }
  // Responde la parte que NO propuso: puede aceptar o sugerir otro lugar.
  return { canPropose: true, canAccept: true, reason: null, status: null };
}

// Si esta persona puede confirmar ahora que la devolución se concretó.
// La confirma quien RECUPERA el objeto: la fila de returns le suma puntos de reputación a quien devolvió,
// así que quien devuelve no puede registrarla por su cuenta. Se exige el punto de encuentro acordado.
function returnActions({ claim, current, completedReturn, userId }) {
  if (completedReturn) return { canConfirm: false, reason: 'La devolución ya fue confirmada.', status: 409 };
  if (userId !== recoveredIdOf(claim)) {
    return { canConfirm: false, reason: 'La devolución la confirma quien recupera el objeto.', status: 403 };
  }
  if (!current || current.status !== 'accepted') {
    return { canConfirm: false, reason: 'Primero tienen que acordar el punto de encuentro.', status: 409 };
  }
  return { canConfirm: true, reason: null, status: null };
}

// Arma lo que ve quien consulta el encuentro. Solo salen datos de las dos partes del reclamo.
function toMeetingView({ claim, current, completedReturn = null, userId }) {
  const isClaimer = claim.claimer_id === userId;
  const actions = meetingActions({ claim, current, userId });
  const toNumber = (v) => (v === null || v === undefined ? null : Number(v));
  return {
    claimId: claim.id,
    iHaveTheObject: userId === holderIdOf(claim),
    otherParty: isClaimer
      ? { id: claim.publisher_id, name: claim.publisher_name }
      : { id: claim.claimer_id, name: claim.claimer_name },
    meetingPoint: current
      ? {
          id: current.id,
          address: current.address,
          notes: current.notes,
          latitude: toNumber(current.latitude),
          longitude: toNumber(current.longitude),
          status: current.status,
          proposedByMe: current.proposed_by === userId,
          proposedBy: { id: current.proposed_by, name: current.proposer_name },
          createdAt: new Date(current.created_at).toISOString(),
          respondedAt: current.responded_at ? new Date(current.responded_at).toISOString() : null,
        }
      : null,
    canPropose: actions.canPropose,
    canAccept: actions.canAccept,
    reason: actions.reason,
    // El id de returns es bigint (pg lo entrega como texto): se expone como número.
    completedReturn: completedReturn
      ? { id: Number(completedReturn.id), createdAt: new Date(completedReturn.created_at).toISOString() }
      : null,
    canConfirmReturn: returnActions({ claim, current, completedReturn, userId }).canConfirm,
  };
}

// ---------------------------------------------------------------------------
// Acceso a datos
// ---------------------------------------------------------------------------

const newMeetingId = () => 'm_' + crypto.randomBytes(12).toString('hex');

const CLAIM_SQL = `
  SELECT c.id, c.publication_id, c.publisher_id, c.claimer_id, c.publication_type, c.status,
         pub.name AS publisher_name, cl.name AS claimer_name
    FROM claims c
    JOIN users pub ON pub.id = c.publisher_id
    JOIN users cl ON cl.id = c.claimer_id
   WHERE c.id = $1`;

const CURRENT_SQL = `
  SELECT mp.*, u.name AS proposer_name
    FROM meeting_points mp
    JOIN users u ON u.id = mp.proposed_by
   WHERE mp.claim_id = $1 AND mp.status IN ('proposed', 'accepted')`;

// Hay a lo sumo una devolución por reclamo (UNIQUE claim_id).
const RETURN_SQL = 'SELECT id, created_at FROM returns WHERE claim_id = $1';

// El reclamo tiene que existir, ser de esta persona y estar aceptado. A quien no es parte no se le revela que existe.
// `db` es el pool o el cliente de una transacción; con `lock` se bloquea la fila del reclamo.
async function loadAcceptedClaim(db, userId, claimId, { lock = false } = {}) {
  const r = await db.query(CLAIM_SQL + (lock ? ' FOR UPDATE OF c' : ''), [claimId]);
  const claim = r.rows[0];
  if (!claim || (claim.publisher_id !== userId && claim.claimer_id !== userId)) {
    throw new HttpError(404, 'Reclamo no encontrado.');
  }
  if (claim.status !== 'accepted') {
    throw new HttpError(409, 'La coordinación del encuentro se habilita cuando el reclamo está aceptado.');
  }
  return claim;
}

async function getMeeting(userId, claimId) {
  const claim = await loadAcceptedClaim({ query }, userId, claimId);
  const [point, done] = await Promise.all([query(CURRENT_SQL, [claimId]), query(RETURN_SQL, [claimId])]);
  return toMeetingView({ claim, current: point.rows[0] || null, completedReturn: done.rows[0] || null, userId });
}

// Propone el primer lugar (quien tiene el objeto) o sugiere otro distinto al vigente (la otra parte).
async function proposeMeeting(userId, claimId, body) {
  const { input, error } = buildMeetingInput(body);
  if (error) throw new HttpError(error.status, error.message);

  try {
    await withTransaction(async (c) => {
      // Se bloquea primero el reclamo y después los puntos (igual que al aceptar) para no trabarse entre pedidos.
      // El servidor valida el rol y el estado: dos pedidos simultáneos se atienden de a uno.
      const claim = await loadAcceptedClaim(c, userId, claimId, { lock: true });
      const r = await c.query(`${CURRENT_SQL} FOR UPDATE OF mp`, [claimId]);
      const current = r.rows[0] || null;

      const actions = meetingActions({ claim, current, userId });
      if (!actions.canPropose) throw new HttpError(actions.status, actions.reason);

      if (current) {
        // La contrapropuesta deja el historial: el anterior pasa a counter_proposed y el nuevo apunta a él.
        await c.query(`UPDATE meeting_points SET status = 'counter_proposed', responded_at = now() WHERE id = $1`, [current.id]);
      }
      await c.query(
        `INSERT INTO meeting_points (id, claim_id, proposed_by, replaces_id, address, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newMeetingId(), claimId, userId, current ? current.id : null, input.address, input.notes]
      );
    });
  } catch (e) {
    // Red de seguridad: el índice único de la base corta cualquier carrera que se haya escapado.
    if (e && e.code === '23505') throw new HttpError(409, 'El punto de encuentro cambió, actualizá la pantalla.');
    throw e;
  }
  return getMeeting(userId, claimId);
}

// La parte que NO propuso acepta el lugar vigente.
async function acceptMeeting(userId, meetingPointId) {
  const first = await query('SELECT claim_id FROM meeting_points WHERE id = $1', [meetingPointId]);
  if (first.rowCount === 0) throw new HttpError(404, 'Punto de encuentro no encontrado.');
  const claimId = first.rows[0].claim_id;

  await withTransaction(async (c) => {
    let claim;
    try {
      claim = await loadAcceptedClaim(c, userId, claimId, { lock: true });
    } catch (e) {
      // Para quien no es parte, el punto tampoco existe.
      if (e instanceof HttpError && e.status === 404) throw new HttpError(404, 'Punto de encuentro no encontrado.');
      throw e;
    }
    const r = await c.query('SELECT id, status, proposed_by FROM meeting_points WHERE id = $1 FOR UPDATE', [meetingPointId]);
    const point = r.rows[0];
    if (!point) throw new HttpError(404, 'Punto de encuentro no encontrado.');

    // El estado puede haber cambiado mientras la persona tenía la pantalla abierta: el servidor manda.
    if (point.status === 'accepted') throw new HttpError(409, 'El punto de encuentro ya fue acordado.');
    if (point.status === 'counter_proposed') {
      throw new HttpError(409, 'Esta propuesta fue reemplazada por otra. Actualizá la pantalla.');
    }
    if (point.proposed_by === userId) {
      throw new HttpError(403, 'No podés aceptar tu propia propuesta: responde la otra persona.');
    }
    await c.query(`UPDATE meeting_points SET status = 'accepted', responded_at = now() WHERE id = $1`, [meetingPointId]);
  });
  return getMeeting(userId, claimId);
}

// Quien recupera el objeto confirma la devolución: se registra en returns y la publicación queda resuelta.
// Todo en una transacción; el reclamo sigue "accepted" (el TPO no define otro estado).
async function confirmReturn(userId, claimId) {
  try {
    await withTransaction(async (c) => {
      const first = await c.query('SELECT publication_id, publisher_id, claimer_id FROM claims WHERE id = $1', [claimId]);
      const row = first.rows[0];
      // A quien no es parte no se le revela que el reclamo existe, y no se bloquea nada por un reclamo ajeno.
      if (!row || (row.publisher_id !== userId && row.claimer_id !== userId)) {
        throw new HttpError(404, 'Reclamo no encontrado.');
      }
      // Primero la publicación y después el reclamo, igual que al aceptar o rechazar un reclamo, para no trabarse entre pedidos.
      await c.query('SELECT id FROM publications WHERE id = $1 FOR UPDATE', [row.publication_id]);
      const claim = await loadAcceptedClaim(c, userId, claimId, { lock: true });
      const point = await c.query(`${CURRENT_SQL} FOR UPDATE OF mp`, [claimId]);
      const current = point.rows[0] || null;
      const done = await c.query(RETURN_SQL, [claimId]);

      // El servidor valida el rol y el estado: dos confirmaciones simultáneas se atienden de a una.
      const actions = returnActions({ claim, current, completedReturn: done.rows[0] || null, userId });
      if (!actions.canConfirm) throw new HttpError(actions.status, actions.reason);

      // Los valores salen del reclamo, no del pedido: user_id es quien devolvió y recovered_by_id quien recuperó.
      await c.query(
        `INSERT INTO returns (user_id, recovered_by_id, claim_id, meeting_point_id)
         VALUES ($1, $2, $3, $4)`,
        [holderIdOf(claim), recoveredIdOf(claim), claimId, current.id]
      );
      // Solo se resuelve una publicación en reclamo (o vencida con un reclamo aceptado, datos viejos). Si no cambió ninguna fila
      // (ya estaba 'resolved' u otro estado inesperado) se aborta: al lanzar el error se deshace también el INSERT en returns,
      // así no queda una devolución registrada sobre una publicación que no refleja el cierre.
      const resolved = await c.query(
        `UPDATE publications SET status = 'resolved', status_changed_at = now()
         WHERE id = $1 AND status IN ('in_claim', 'expired')`,
        [claim.publication_id]
      );
      if (resolved.rowCount !== 1) throw new HttpError(409, 'La publicación ya no admite que se confirme la devolución.');
    });
  } catch (e) {
    // Red de seguridad: el UNIQUE (claim_id) de la base corta cualquier carrera que se haya escapado.
    if (e && e.code === '23505') throw new HttpError(409, 'La devolución ya fue confirmada.');
    throw e;
  }
  return getMeeting(userId, claimId);
}

module.exports = {
  holderIdOf,
  recoveredIdOf,
  buildMeetingInput,
  meetingActions,
  returnActions,
  toMeetingView,
  getMeeting,
  proposeMeeting,
  acceptMeeting,
  confirmReturn,
};
