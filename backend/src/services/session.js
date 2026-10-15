const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../db');
const { HttpError } = require('../middleware/errors');
const { normalizeEmail } = require('./otp');
const {
  BCRYPT_COST,
  DUMMY_HASH,
  REFRESH_RE,
  hashRefreshToken,
  createSession,
} = require('./tokens');

const badLogin = () => new HttpError(401, 'Email o contraseña incorrectos.');
const expired = () => new HttpError(401, 'La sesión venció. Volvé a iniciar sesión.');

async function login(body) {
  const email = normalizeEmail(body?.email);
  const password = body?.password;
  if (typeof password !== 'string' || !email || password.length === 0 || Buffer.byteLength(password) > 72) {
    throw badLogin();
  }
  const found = await query('SELECT * FROM users WHERE email = $1', [email]);
  const row = found.rows[0];
  // Siempre se compara, exista o no el usuario, para no filtrar por tiempo.
  const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok) throw badLogin();
  return createSession({ query }, row);
}

async function refresh(body) {
  const t = body?.refreshToken;
  if (typeof t !== 'string' || !REFRESH_RE.test(t)) throw expired();
  const h = hashRefreshToken(t);

  const r = await withTransaction(async (c) => {
    const upd = await c.query(
      `UPDATE refresh_tokens SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() RETURNING user_id`,
      [h]
    );
    if (upd.rowCount === 1) {
      const u = await c.query('SELECT * FROM users WHERE id = $1', [upd.rows[0].user_id]);
      if (u.rowCount === 0) return { invalid: true };
      return { session: await createSession(c, u.rows[0]) };
    }
    const prev = await c.query(
      `SELECT user_id, revoked_at IS NOT NULL AS revoked,
              revoked_at > now() - interval '10 seconds' AS recent
       FROM refresh_tokens WHERE token_hash = $1`,
      [h]
    );
    if (prev.rowCount === 1 && prev.rows[0].revoked) {
      // Gracia de 10 s: un doble refresh legítimo (reintento, carrera) solo falla ese pedido
      // sin tumbar la familia. Pasada la gracia, se trata como robo y se revoca todo.
      if (prev.rows[0].recent) return { invalid: true };
      const userId = prev.rows[0].user_id;
      await c.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
      console.warn('[AUTH] reuso de refresh token; familia revocada', userId);
      return { reuse: true };
    }
    return { invalid: true };
  });

  // El 401 se lanza después del COMMIT para no deshacer la revocación.
  if (r.reuse || r.invalid) throw expired();
  return r.session;
}

module.exports = { login, refresh, DUMMY_HASH, BCRYPT_COST };
