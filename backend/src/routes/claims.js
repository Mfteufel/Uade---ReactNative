const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { usersLimiter, photoUploadLimiter } = require('../middleware/rateLimit');
const { rejectIfTooLarge, uploadGate, parsePhoto } = require('../middleware/upload');
const { saveClaimPhoto } = require('../services/photos');
const claims = require('../services/claims');
const { HttpError } = require('../middleware/errors');

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const validId = (id, message) => {
  if (!ID_RE.test(id)) throw new HttpError(404, message);
  return id;
};
const validClaimId = (id) => validId(id, 'Reclamo no encontrado.');

// Envuelve un handler async para mandar los errores al errorHandler.
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};

// /reclamos/*
const router = Router();
router.use(requireAuth, usersLimiter);

// Paso previo a crear un reclamo con foto: la foto se sube sola y el reclamo la referencia con photoId.
router.post('/foto', photoUploadLimiter, rejectIfTooLarge, uploadGate, parsePhoto, async (req, res, next) => {
  if (res.headersSent) return;
  req.photoProcessing = true; // desde acá libera el finally, no el 'close' del cliente
  try {
    const result = await saveClaimPhoto(req.user.id, req.file && req.file.buffer);
    if (!res.headersSent) res.status(201).json(result);
  } catch (e) {
    next(e);
  } finally {
    req.releaseGate();
  }
});

// Antes que '/:id' para que "enviados" y "recibidos" no se tomen como un id.
router.get('/enviados', handle(async (req, res) => res.json(await claims.listSent(req.user.id))));
router.get('/recibidos', handle(async (req, res) => res.json(await claims.listReceived(req.user.id))));

router.get('/:id', handle(async (req, res) => res.json(await claims.getClaim(req.user.id, validClaimId(req.params.id)))));
router.post('/:id/aceptar', handle(async (req, res) => res.json(await claims.acceptClaim(req.user.id, validClaimId(req.params.id)))));
router.post('/:id/rechazar', handle(async (req, res) => res.json(await claims.rejectClaim(req.user.id, validClaimId(req.params.id)))));

// /publicaciones/:publicationId/reclamos/*
// Se monta con su propio prefijo: el resto de /publicaciones lo define el router de publicaciones.
const publicationClaimsRouter = Router({ mergeParams: true });
publicationClaimsRouter.use(requireAuth, usersLimiter);

const validPublicationId = (req) => validId(req.params.publicationId, 'Publicación no encontrada.');

publicationClaimsRouter.get('/formulario', handle(async (req, res) => {
  res.json(await claims.getClaimFormInfo(req.user.id, validPublicationId(req)));
}));

publicationClaimsRouter.post('/', handle(async (req, res) => {
  res.status(201).json(await claims.createClaim(req.user.id, validPublicationId(req), req.body));
}));

module.exports = { router, publicationClaimsRouter };
