const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { unauthLimiter, usersLimiter } = require('../middleware/rateLimit');
const { validPublicationId } = require('../middleware/publicationId');
const { getPublicationDetail } = require('../services/publicationDetail');

const router = Router();

// Los middlewares van en la ruta para no afectar a otras rutas que empiecen con /publicaciones.
router.get('/:id', unauthLimiter, requireAuth, usersLimiter, async (req, res, next) => {
  try {
    res.json(await getPublicationDetail(validPublicationId(req.params.id), req.user.id));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
