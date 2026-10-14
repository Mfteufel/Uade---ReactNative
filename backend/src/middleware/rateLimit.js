const { rateLimit } = require('express-rate-limit');

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: 429,
  message: { message: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' },
};

const loginLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true });
const authLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 60 });
const otpLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 5 });
const resetLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true });

module.exports = { loginLimiter, authLimiter, otpLimiter, resetLimiter };
