const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { usersLimiter } = require('../middleware/rateLimit');
const returns = require('../services/returns');

// /devoluciones/*: acciones sobre una devolución (valorar; después, agradecer).
const router = Router();
router.use(requireAuth, usersLimiter);

router.post('/:id/valoraciones', async (req, res, next) => {
  try {
    res.status(201).json(await returns.rateReturn(req.user.id, req.params.id, req.body));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
