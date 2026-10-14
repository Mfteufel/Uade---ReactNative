const crypto = require('crypto');
const bcrypt = require('bcryptjs');

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
  normalizeEmail,
  isValidEmail,
};
