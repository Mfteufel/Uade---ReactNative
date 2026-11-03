const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { usersLimiter } = require('../middleware/rateLimit');
const alerts = require('../services/alerts');

const router = Router();
router.use(requireAuth, usersLimiter);

router.get('/', async (req, res, next) => {
  try {
    res.json(await alerts.listAlerts(req.user.id));
  } catch (e) {
    next(e);
  }
});

// Body: { "tipo": "found", "categoria": "keys", "q": "osito", "barrio": "palermo" }. Solo tipo es obligatorio.
router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await alerts.createAlert(req.user.id, req.body));
  } catch (e) {
    next(e);
  }
});

// Body: { "pausada": true }
router.post('/:id/pausa', async (req, res, next) => {
  try {
    await alerts.setAlertPaused(req.user.id, req.params.id, req.body);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await alerts.deleteAlert(req.user.id, req.params.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.post('/:id/vista', async (req, res, next) => {
  try {
    await alerts.markAlertSeen(req.user.id, req.params.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

module.exports = router;
