const { query } = require('../db');
const { HttpError } = require('../middleware/errors');
const { toUser } = require('./tokens');

// Lista blanca: campo del body -> columna. Nada más se puede modificar por acá.
const COLUMNS = {
  name: 'name',
  neighborhood: 'neighborhood',
  phone: 'phone',
  phoneVisibleOnClaim: 'phone_visible_on_claim',
};
const MAX_LEN = { name: 80, neighborhood: 80, phone: 30 };
const LABEL = { name: 'El nombre', neighborhood: 'El barrio', phone: 'El teléfono' };
// Caracteres de control (incluye NUL) y marcas bidi (U+202A-202E, U+2066-2069).
const FORBIDDEN_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;

// Pura. Devuelve { fields } (clave del body -> valor limpio) o { error: { status, message } }.
function buildProfileUpdate(body) {
  const fields = {};
  if (body === undefined || body === null) return { fields };
  if (typeof body !== 'object' || Array.isArray(body)) {
    return { error: { status: 422, message: 'El cuerpo debe ser un objeto JSON.' } };
  }
  for (const key of Object.keys(COLUMNS)) {
    if (!Object.prototype.hasOwnProperty.call(body, key) || body[key] === undefined) continue;
    const v = body[key];
    if (key === 'phoneVisibleOnClaim') {
      if (typeof v !== 'boolean') {
        return { error: { status: 422, message: 'phoneVisibleOnClaim debe ser verdadero o falso.' } };
      }
      fields[key] = v;
      continue;
    }
    if (typeof v !== 'string') {
      return { error: { status: 422, message: `${LABEL[key]} debe ser texto.` } };
    }
    const s = v.trim();
    if (FORBIDDEN_CHARS.test(s)) {
      return { error: { status: 422, message: `${LABEL[key]} tiene caracteres no permitidos.` } };
    }
    if (key === 'name' && !/[\p{L}\p{N}]/u.test(s)) {
      return { error: { status: 422, message: 'El nombre no puede estar vacío.' } };
    }
    if (s.length > MAX_LEN[key]) {
      return { error: { status: 422, message: `${LABEL[key]} no puede superar los ${MAX_LEN[key]} caracteres.` } };
    }
    fields[key] = s;
  }
  return { fields };
}

async function getMe(userId) {
  const r = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (r.rowCount === 0) throw new HttpError(401, 'Sesión inválida. Volvé a iniciar sesión.');
  return toUser(r.rows[0]);
}

async function updateMe(userId, body) {
  const { error, fields } = buildProfileUpdate(body);
  if (error) throw new HttpError(error.status, error.message);
  const keys = Object.keys(fields);
  if (keys.length === 0) return getMe(userId);
  const sets = keys.map((k, i) => `${COLUMNS[k]} = $${i + 2}`);
  const r = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    [userId, ...keys.map((k) => fields[k])]
  );
  if (r.rowCount === 0) throw new HttpError(401, 'Sesión inválida. Volvé a iniciar sesión.');
  return toUser(r.rows[0]);
}

module.exports = { FORBIDDEN_CHARS, buildProfileUpdate, getMe, updateMe };
