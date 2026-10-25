const { Router } = require('express');
const { query } = require('../db');
const { HttpError } = require('../middleware/errors');

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = 'Foto no encontrada.';

router.get('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id).toLowerCase();
    if (!UUID_RE.test(id)) throw new HttpError(404, NOT_FOUND);
    // Solo la foto vigente de algún usuario o la foto adjunta a un reclamo.
    // Las fotos de reclamo no tienen otra protección que su UUID: la app solo se lo da a las dos partes del reclamo.
    const r = await query(
      `SELECT p.data FROM photos p
        WHERE p.id = $1
          AND (EXISTS (SELECT 1 FROM users u WHERE u.photo_id = p.id)
               OR EXISTS (SELECT 1 FROM claims c WHERE c.photo_id = p.id))`,
      [id]
    );
    if (r.rowCount === 0) throw new HttpError(404, NOT_FOUND);
    res.set({
      'Content-Type': 'image/jpeg',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: `"${id}"`,
      'Content-Disposition': 'inline; filename="photo.jpg"',
      'Content-Security-Policy': "default-src 'none'",
    });
    res.send(r.rows[0].data);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
