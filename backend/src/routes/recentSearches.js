const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { usersLimiter } = require('../middleware/rateLimit');
const search = require('../services/search');

// Envuelve un handler async para mandar los errores al errorHandler.
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};

// /busquedas-recientes/*
const router = Router();
router.use(requireAuth, usersLimiter);

router.get('/', handle(async (req, res) => res.json(await search.listRecent(req.user.id))));
router.post('/', handle(async (req, res) => res.status(201).json(await search.saveRecent(req.user.id, req.body))));
router.delete('/:id', handle(async (req, res) => {
  await search.deleteRecent(req.user.id, req.params.id);
  res.status(204).end();
}));

module.exports = router;
