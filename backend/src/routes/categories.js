const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { usersLimiter } = require('../middleware/rateLimit');
const { listCategories } = require('../services/search');

const router = Router();
router.use(requireAuth, usersLimiter);

// Catálogo de categorías para el buscador y los formularios, en el orden de sort_order.
router.get('/', async (req, res, next) => {
  try {
    res.json(await listCategories());
  } catch (e) {
    next(e);
  }
});

module.exports = router;
