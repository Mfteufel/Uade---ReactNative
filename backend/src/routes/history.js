const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { usersLimiter } = require('../middleware/rateLimit');
const history = require('../services/history');

const router = Router();
router.use(requireAuth, usersLimiter);

// Solo devoluciones del propio usuario (el id sale del token, nunca de la URL).
router.get('/', async (req, res, next) => {
  try {
    res.json(await history.getHistory(req.user.id, req.query));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
