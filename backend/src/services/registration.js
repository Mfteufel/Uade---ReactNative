const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../db');
const { HttpError } = require('../middleware/errors');
const otp = require('./otp');
const otpStore = require('./otpStore');
const { assertNewPassword } = require('./passwordRules');
const { BCRYPT_COST, signRegistrationToken, verifyRegistrationToken, createSession } = require('./tokens');

async function requestOtp(body) {
  const email = otp.normalizeEmail(body?.email);
  if (!otp.isValidEmail(email)) throw new HttpError(422, 'El email no es válido.');

  const exists = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rowCount > 0) throw new HttpError(409, 'Ya existe una cuenta con ese email.');

  return otpStore.issueOtp(email, 'register');
}

async function verifyOtp(body) {
  const email = otp.normalizeEmail(body?.email);
  if (!otp.isValidEmail(email)) throw new HttpError(422, 'El email no es válido.');
  if (!otp.isValidCodeFormat(body?.code)) throw new HttpError(422, 'El código tiene 6 dígitos.');
  const code = body.code.trim();

  const r = await withTransaction((c) => otpStore.consumeOtp(c, email, 'register', code));
  const err = otp.outcomeError(r);
  if (err) throw err;
  return { registrationToken: signRegistrationToken(email) };
}

async function setPassword(body) {
  const { email } = verifyRegistrationToken(body?.registrationToken);
  const password = body?.password;
  assertNewPassword(password);
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
