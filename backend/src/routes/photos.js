const { Router } = require('express');
const { query } = require('../db');
const { HttpError } = require('../middleware/errors');
const { parseBearer } = require('../middleware/auth');
const { verifyAccessToken } = require('../services/tokens');

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = 'Foto no encontrada.';

const BASE_HEADERS = {
  'Content-Type': 'image/jpeg',
  'X-Content-Type-Options': 'nosniff',
  'Content-Disposition': 'inline; filename="photo.jpg"',
  'Content-Security-Policy': "default-src 'none'",
};

// Las fotos de perfil son públicas (se ven en perfiles y reclamos) y se pueden cachear.
const PUBLIC_HEADERS = { ...BASE_HEADERS, 'Cache-Control': 'public, max-age=31536000, immutable' };
// Las fotos de reclamo son evidencia privada: ningún proxy ni caché compartido las puede guardar.
const PRIVATE_HEADERS = { ...BASE_HEADERS, 'Cache-Control': 'private, no-store' };

// Usuario autenticado que pide la foto de un reclamo (el token viaja en el header Authorization).
function requesterId(req) {
  const token = parseBearer(req.headers.authorization);
  if (!token) throw new HttpError(401, 'Sesión inválida. Volvé a iniciar sesión.');
  return verifyAccessToken(token).userId;
}

router.get('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id).toLowerCase();
    if (!UUID_RE.test(id)) throw new HttpError(404, NOT_FOUND);
    // Solo se sirve la foto vigente de algún usuario o la foto adjunta a un reclamo.
    const r = await query(
      `SELECT p.data,
              EXISTS (SELECT 1 FROM users u WHERE u.photo_id = p.id) AS is_profile,
              c.claimer_id, c.publisher_id
         FROM photos p
         LEFT JOIN claims c ON c.photo_id = p.id
        WHERE p.id = $1
          AND (EXISTS (SELECT 1 FROM users u WHERE u.photo_id = p.id) OR c.id IS NOT NULL)`,
      [id]
    );
    if (r.rowCount === 0) throw new HttpError(404, NOT_FOUND);
    const photo = r.rows[0];

    if (photo.is_profile) {
      res.set({ ...PUBLIC_HEADERS, ETag: `"${id}"` });
    } else {
      // Foto de un reclamo: solo la ven las dos partes. A cualquier otra persona se le responde
      // lo mismo que si la foto no existiera.
      const userId = requesterId(req);
      if (userId !== photo.claimer_id && userId !== photo.publisher_id) throw new HttpError(404, NOT_FOUND);
      res.set(PRIVATE_HEADERS);
    }
    res.send(photo.data);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
