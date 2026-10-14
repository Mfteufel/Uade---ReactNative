const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { HttpError } = require('../middleware/errors');

const OTP_TTL_SEC = 600;
const OTP_RESEND_SEC = 60;
const OTP_MAX_ATTEMPTS = 5;

const generateCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
const hashCode = (code) => bcrypt.hash(code, 10);
const compareCode = (code, hash) => bcrypt.compare(code, hash);
const isValidCodeFormat = (code) => typeof code === 'string' && /^\d{6}$/.test(code.trim());
const cooldownRemaining = (ageSec) => Math.max(0, Math.ceil(OTP_RESEND_SEC - ageSec));

function evaluateAttempt({ expired, matches, attempts }) {
  if (expired) return { outcome: 'expired' };
  if (matches) return { outcome: 'ok' };
  const next = attempts + 1;
  if (next >= OTP_MAX_ATTEMPTS) return { outcome: 'locked', attempts: next };
  return { outcome: 'wrong', attempts: next, left: OTP_MAX_ATTEMPTS - next };
}

const wrongCodeMessage = (left) =>
  left === 1 ? 'Código incorrecto. Te queda 1 intento.' : `Código incorrecto. Te quedan ${left} intentos.`;

function outcomeError(r) {
  if (r.none) return new HttpError(400, 'Pedí un código primero.');
  if (r.outcome === 'expired') return new HttpError(410, 'El código venció. Pedí uno nuevo.');
  if (r.outcome === 'wrong') return new HttpError(400, wrongCodeMessage(r.left));
  if (r.outcome === 'locked') return new HttpError(429, 'Demasiados intentos fallidos. Pedí un código nuevo.');
  return null;
}

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');
const isValidEmail = (email) =>
  typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

module.exports = {
  OTP_TTL_SEC,
  OTP_RESEND_SEC,
  OTP_MAX_ATTEMPTS,
  generateCode,
  hashCode,
  compareCode,
  isValidCodeFormat,
  cooldownRemaining,
  evaluateAttempt,
  wrongCodeMessage,
  outcomeError,
  normalizeEmail,
  isValidEmail,
};
