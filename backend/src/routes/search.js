const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { unauthLimiter, usersLimiter } = require('../middleware/rateLimit');
const search = require('../services/search');

// /publicaciones: acá solo vive el listado (GET /). El detalle (/:id) y el resto los define otro router.
// Los middlewares van en la ruta y no en el router: este router se monta en /publicaciones, que comparte prefijo con
// /publicaciones/:publicationId/reclamos, y así ese pedido no pasa dos veces por el rate limit ni por requireAuth.
const router = Router();

router.get('/', unauthLimiter, requireAuth, usersLimiter, async (req, res, next) => {
  try {
    res.json(await search.search(req.user.id, req.query));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
