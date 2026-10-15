const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { HttpError } = require('../middleware/errors');
const { photoUrl } = require('./photoUrl');

const BCRYPT_COST = 10;
const ACCESS_TTL = '15m';
const REFRESH_TTL_DAYS = 30;
const REFRESH_RE = /^[A-Za-z0-9_-]{43}$/;
// Hash de relleno: login siempre corre bcrypt.compare aunque el usuario no exista.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_COST);

function signRegistrationToken(email) {
  return jwt.sign({ purpose: 'register', email }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '30m',
    audience: 'register',
  });
}

function verifyRegistrationToken(token) {
  try {
    if (typeof token !== 'string') throw new Error('token');
    const p = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], audience: 'register' });
    if (p.purpose !== 'register' || typeof p.email !== 'string') throw new Error('purpose');
    return { email: p.email };
  } catch {
    throw new HttpError(401, 'El registro venció. Empezá de nuevo.');
  }
}

function signAccessToken(userId) {
  return jwt.sign({ purpose: 'access' }, JWT_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    audience: 'access',
    expiresIn: ACCESS_TTL,
  });
}

function verifyAccessToken(token) {
  try {
    if (typeof token !== 'string') throw new Error('token');
    const p = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], audience: 'access' });
    if (p.purpose !== 'access' || typeof p.sub !== 'string' || p.sub.length === 0) throw new Error('claims');
    return { userId: p.sub };
  } catch {
    throw new HttpError(401, 'Sesión inválida. Volvé a iniciar sesión.');
  }
}

const hashRefreshToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

function toUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    photoUri: photoUrl(row.photo_id),
    neighborhood: row.neighborhood,
    phone: row.phone,
    phoneVisibleOnClaim: row.phone_visible_on_claim,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function createSession(client, userRow) {
  const accessToken = signAccessToken(userRow.id);
  const refreshToken = crypto.randomBytes(32).toString('base64url');
  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`,
    [userRow.id, hashRefreshToken(refreshToken), REFRESH_TTL_DAYS]
  );
  return { user: toUser(userRow), accessToken, refreshToken };
}

module.exports = {
  BCRYPT_COST,
  ACCESS_TTL,
  REFRESH_TTL_DAYS,
  REFRESH_RE,
  DUMMY_HASH,
  signRegistrationToken,
  verifyRegistrationToken,
  signAccessToken,
  verifyAccessToken,
  hashRefreshToken,
  createSession,
  toUser,
};
