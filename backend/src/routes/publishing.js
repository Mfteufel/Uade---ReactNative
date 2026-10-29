const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { unauthLimiter, usersLimiter, publicationPhotoLimiter } = require('../middleware/rateLimit');
const { rejectIfTooLarge, uploadGate, parsePhoto } = require('../middleware/upload');
const publishing = require('../services/publishing');
const { HttpError } = require('../middleware/errors');

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const validPublicationId = (id) => {
  if (!ID_RE.test(id)) throw new HttpError(404, 'Publicación no encontrada.');
  return id;
};

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};

// Varios routers comparten /publicaciones (buscador, detalle, reclamos): los middlewares van en cada
// ruta y no con router.use, así no se aplican a pedidos que son de otro router.
const auth = [unauthLimiter, requireAuth, usersLimiter];

const router = Router();

router.post('/fotos', ...auth, publicationPhotoLimiter, rejectIfTooLarge, uploadGate, parsePhoto, async (req, res, next) => {
  if (res.headersSent) return;
  req.photoProcessing = true; // desde acá libera el finally, no el 'close' del cliente
  try {
    const result = await publishing.savePublicationPhoto(req.user.id, req.file && req.file.buffer);
    if (!res.headersSent) res.status(201).json(result);
  } catch (e) {
    next(e);
  } finally {
    req.releaseGate();
  }
});

// 201 si se creó; 200 si ese clientId ya existía (reintento de un envío que sí había llegado).
router.post('/', ...auth, handle(async (req, res) => {
  const { created, publication } = await publishing.createPublication(req.user.id, req.body);
  res.status(created ? 201 : 200).json(publication);
}));

// Este router se monta antes que el del detalle (GET /:id), si no "mias" se tomaría como un id.
router.get('/mias', ...auth, handle(async (req, res) => res.json(await publishing.listMine(req.user.id))));

router.post('/:id/renovar', ...auth, handle(async (req, res) => {
  res.json(await publishing.renewPublication(req.user.id, validPublicationId(req.params.id)));
}));

module.exports = router;
