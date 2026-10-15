const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../db');
const { HttpError } = require('../middleware/errors');
const otp = require('./otp');
const otpStore = require('./otpStore');
const { assertNewPassword } = require('./passwordRules');
const { BCRYPT_COST } = require('./tokens');

const noAccount = () => new HttpError(404, 'No existe una cuenta con ese email.');

async function requestOtp(body) {
  const email = otp.normalizeEmail(body?.email);
  if (!otp.isValidEmail(email)) throw new HttpError(422, 'El email no es válido.');

  const exists = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rowCount === 0) throw noAccount();

  return otpStore.issueOtp(email, 'reset');
}

async function reset(body) {
  const email = otp.normalizeEmail(body?.email);
  if (!otp.isValidEmail(email)) throw new HttpError(422, 'El email no es válido.');
  const newPassword = body?.newPassword;
  assertNewPassword(newPassword);
  if (!otp.isValidCodeFormat(body?.code)) throw new HttpError(422, 'El código tiene 6 dígitos.');
  const code = body.code.trim();

  const r = await withTransaction(async (c) => {
    const o = await otpStore.consumeOtp(c, email, 'reset', code);
    if (o.none || o.outcome !== 'ok') return o;
    const hash = await bcrypt.hash(newPassword, BCRYPT_COST);
    const u = await c.query('UPDATE users SET password_hash = $2 WHERE email = $1 RETURNING id', [email, hash]);
    if (!u.rowCount) return { noUser: true };
    // DELETE (no revoked_at): a stale token then yields 'invalid' instead of tripping reuse detection on new sessions.
    await c.query('DELETE FROM refresh_tokens WHERE user_id = $1', [u.rows[0].id]);
    return { ok: true };
  });

  const err = otp.outcomeError(r);
  if (err) throw err;
  if (r.noUser) throw noAccount();
  return { message: 'Contraseña actualizada.' };
}

module.exports = { requestOtp, reset };
