const { withTransaction } = require('../db');
const { HttpError } = require('../middleware/errors');
const otp = require('./otp');
const { sendOtpEmail } = require('./mailer');

const PURPOSES = ['register', 'reset'];

const tooSoon = (wait) => new HttpError(429, `Esperá ${wait} segundos para pedir otro código.`);

function assertPurpose(purpose) {
  if (!PURPOSES.includes(purpose)) throw new Error(`purpose inválido: ${purpose}`);
}

async function issueOtp(email, purpose) {
  assertPurpose(purpose);
  const code = otp.generateCode();
  const hash = await otp.hashCode(code);

  let result;
  try {
    result = await withTransaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('otp:' || $2 || ':' || $1))`, [email, purpose]);
      const last = await client.query(
        `SELECT EXTRACT(EPOCH FROM now() - created_at) AS age FROM otp_codes
         WHERE email = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1`,
        [email, purpose]
      );
      if (last.rowCount > 0) {
        const wait = otp.cooldownRemaining(Number(last.rows[0].age));
        if (wait > 0) return { wait };
      }
      const recent = await client.query(
        `SELECT count(*)::int AS n FROM otp_codes
         WHERE email = $1 AND purpose = $2 AND created_at > now() - interval '1 hour'`,
        [email, purpose]
      );
      if (recent.rows[0].n >= 5) return { capped: true };
      await client.query(
        `UPDATE otp_codes SET used_at = now() WHERE email = $1 AND purpose = $2 AND used_at IS NULL`,
        [email, purpose]
      );
      const ins = await client.query(
        `INSERT INTO otp_codes (email, purpose, code_hash, expires_at)
         VALUES ($1, $2, $3, now() + interval '600 seconds') RETURNING id`,
        [email, purpose, hash]
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
    await sendOtpEmail(email, code, purpose);
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

// Corre dentro de la transacción de quien llama; nunca lanza HttpError.
async function consumeOtp(client, email, purpose, code) {
  assertPurpose(purpose);
  const found = await client.query(
    `SELECT id, code_hash, attempts, expires_at <= now() AS expired FROM otp_codes
     WHERE email = $1 AND purpose = $2 AND used_at IS NULL FOR UPDATE`,
    [email, purpose]
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
    await client.query(
      'UPDATE otp_codes SET used_at = now() WHERE email = $1 AND purpose = $2 AND used_at IS NULL',
      [email, purpose]
    );
  }
  return res;
}

module.exports = { PURPOSES, issueOtp, consumeOtp };
