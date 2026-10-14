const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { HttpError } = require('../middleware/errors');

function signRegistrationToken(email) {
  return jwt.sign({ purpose: 'register', email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '30m' });
}

function verifyRegistrationToken(token) {
  try {
    if (typeof token !== 'string') throw new Error('token');
    const p = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (p.purpose !== 'register' || typeof p.email !== 'string') throw new Error('purpose');
    return { email: p.email };
  } catch {
    throw new HttpError(401, 'El registro venció. Empezá de nuevo.');
  }
}

function toUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    photoUri: null,
    neighborhood: row.neighborhood,
    phone: row.phone,
    phoneVisibleOnClaim: row.phone_visible_on_claim,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function createSession(client, userRow) {
  const accessToken = jwt.sign({ purpose: 'access' }, JWT_SECRET, {
    algorithm: 'HS256',
    subject: userRow.id,
    expiresIn: '15m',
  });
  const refreshToken = crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 days')`,
    [userRow.id, hash]
  );
  return { user: toUser(userRow), accessToken, refreshToken };
}

module.exports = { signRegistrationToken, verifyRegistrationToken, createSession, toUser };
