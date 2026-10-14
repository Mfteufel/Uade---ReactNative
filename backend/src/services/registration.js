const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../db');
const { HttpError } = require('../middleware/errors');
const otp = require('./otp');
const { sendOtpEmail } = require('./mailer');
const { BCRYPT_COST, signRegistrationToken, verifyRegistrationToken, createSession } = require('./tokens');

const tooSoon = (wait) => new HttpError(429, `Esperá ${wait} segundos para pedir otro código.`);

async function requestOtp(body) {
  const email = otp.normalizeEmail(body?.email);
  if (!otp.isValidEmail(email)) throw new HttpError(422, 'El email no es válido.');

  const exists = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rowCount > 0) throw new HttpError(409, 'Ya existe una cuenta con ese email.');

  const code = otp.generateCode();
  const hash = await otp.hashCode(code);

  let result;
  try {
    result = await withTransaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('otp:register:' || $1))`, [email]);
      const last = await client.query(
        `SELECT EXTRACT(EPOCH FROM now() - created_at) AS age FROM otp_codes
         WHERE email = $1 AND purpose = 'register' ORDER BY created_at DESC LIMIT 1`,
        [email]
      );
      if (last.rowCount > 0) {
        const wait = otp.cooldownRemaining(Number(last.rows[0].age));
        if (wait > 0) return { wait };
      }
      const recent = await client.query(
        `SELECT count(*)::int AS n FROM otp_codes
         WHERE email = $1 AND purpose = 'register' AND created_at > now() - interval '1 hour'`,
        [email]
      );
      if (recent.rows[0].n >= 5) return { capped: true };
      await client.query(
        `UPDATE otp_codes SET used_at = now() WHERE email = $1 AND purpose = 'register' AND used_at IS NULL`,
        [email]
      );
      const ins = await client.query(
        `INSERT INTO otp_codes (email, purpose, code_hash, expires_at)
         VALUES ($1, 'register', $2, now() + interval '600 seconds') RETURNING id`,
        [email, hash]
      );
      return { id: ins.rows[0].id };
    });
  } catch (e) {
    if (e.code === '23505') throw tooSoon(otp.OTP_RESEND_SEC);
    throw e;
  }
  if (result.wait) throw tooSoon(result.wait);
  if (result.capped) throw new HttpError(429, 'Pediste demasiados códigos. Probá de nuevo en una hora.');

  try {
    await sendOtpEmail(email, code, 'register');
  } catch (e) {
    // No se borra la fila: el cooldown de 60 s sigue corriendo desde created_at.
    console.error('[MAIL] error al enviar:', e.message);
    throw new HttpError(502, 'No pudimos enviar el email. Probá de nuevo en unos minutos.');
  }

  return {
    message: 'Te enviamos un código de 6 dígitos.',
    expiresInSec: otp.OTP_TTL_SEC,
    resendInSec: otp.OTP_RESEND_SEC,
  };
}

async function verifyOtp(body) {
  const email = otp.normalizeEmail(body?.email);
  if (!otp.isValidEmail(email)) throw new HttpError(422, 'El email no es válido.');
  if (!otp.isValidCodeFormat(body?.code)) throw new HttpError(422, 'El código tiene 6 dígitos.');
  const code = body.code.trim();

  const r = await withTransaction(async (client) => {
    const found = await client.query(
      `SELECT id, code_hash, attempts, expires_at <= now() AS expired FROM otp_codes
       WHERE email = $1 AND purpose = 'register' AND used_at IS NULL FOR UPDATE`,
      [email]
    );
    if (found.rowCount === 0) return { none: true };
    const row = found.rows[0];
    const matches = row.expired ? false : await otp.compareCode(code, row.code_hash);
    const res = otp.evaluateAttempt({ expired: row.expired, matches, attempts: row.attempts });
    if (res.outcome === 'expired') {
      await client.query('UPDATE otp_codes SET used_at = now() WHERE id = $1', [row.id]);
    } else if (res.outcome === 'locked') {
      await client.query('UPDATE otp_codes SET attempts = $2, used_at = now() WHERE id = $1', [row.id, res.attempts]);
    } else if (res.outcome === 'wrong') {
      await client.query('UPDATE otp_codes SET attempts = $2 WHERE id = $1', [row.id, res.attempts]);
    } else {
      await client.query('UPDATE otp_codes SET used_at = now() WHERE id = $1', [row.id]);
    }
    return res;
  });

  if (r.none) throw new HttpError(400, 'Pedí un código primero.');
  if (r.outcome === 'expired') throw new HttpError(410, 'El código venció. Pedí uno nuevo.');
  if (r.outcome === 'wrong') throw new HttpError(400, otp.wrongCodeMessage(r.left));
  if (r.outcome === 'locked') throw new HttpError(429, 'Demasiados intentos fallidos. Pedí un código nuevo.');
  return { registrationToken: signRegistrationToken(email) };
}

async function setPassword(body) {
  const { email } = verifyRegistrationToken(body?.registrationToken);
  const password = body?.password;
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(422, 'La contraseña debe tener al menos 8 caracteres.');
  }
  if (Buffer.byteLength(password) > 72) {
    throw new HttpError(422, 'La contraseña no puede superar los 72 caracteres.');
  }
  const hash = await bcrypt.hash(password, BCRYPT_COST);

  const result = await withTransaction(async (client) => {
    const id = 'u_' + crypto.randomBytes(12).toString('hex');
    const ins = await client.query(
      `INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING RETURNING *`,
      [id, email, hash, email.split('@')[0]]
    );
    if (ins.rowCount === 0) return { conflict: true };
    return { session: await createSession(client, ins.rows[0]) };
  });

  if (result.conflict) throw new HttpError(409, 'Ya existe una cuenta con ese email.');
  return result.session;
}

module.exports = { requestOtp, verifyOtp, setPassword };
