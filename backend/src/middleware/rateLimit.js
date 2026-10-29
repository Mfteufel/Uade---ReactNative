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
// Por usuario (requiere req.user: va después de requireAuth).
const usersLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 300, keyGenerator: (req) => req.user.id });
// Por IP, solo cuenta requests fallidos (sin token / token inválido).
const unauthLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000, limit: 100,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode !== 401, // solo cuentan los 401
});

// Por usuario, cuenta también los intentos fallidos.
const photoUploadLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user.id,
  message: { message: 'Subiste demasiadas fotos. Probá de nuevo en un rato.' },
});
// Límite propio para las fotos de publicaciones (30 por hora). Con el de perfil (10 por hora) y hasta
// 5 fotos por publicación, solo alcanzaría para 2 publicaciones por hora.
const publicationPhotoLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user.id,
  message: { message: 'Subiste demasiadas fotos. Probá de nuevo en un rato.' },
});
// GET /photos/:id público, por IP.
const photosLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 1000 });

module.exports = { photoUploadLimiter, publicationPhotoLimiter, photosLimiter, usersLimiter, unauthLimiter, loginLimiter, authLimiter, otpLimiter, resetLimiter };
