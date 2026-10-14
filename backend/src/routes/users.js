const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { usersLimiter } = require('../middleware/rateLimit');
const profile = require('../services/profile');
const { getPublicProfile } = require('../services/publicProfile');
const { getReputation } = require('../services/reputation');
const { HttpError } = require('../middleware/errors');

const router = Router();
router.use(requireAuth, usersLimiter);

router.get('/me', async (req, res, next) => {
  try {
    res.json(await profile.getMe(req.user.id));
  } catch (e) {
    next(e);
  }
});

router.put('/me', async (req, res, next) => {
  try {
    res.json(await profile.updateMe(req.user.id, req.body));
  } catch (e) {
    next(e);
  }
});

// Después de /me. Id con formato inválido -> 404 (no 500).
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
function validId(id) {
  if (!ID_RE.test(id)) throw new HttpError(404, 'Usuario no encontrado.');
  return id;
}

router.get('/:id/public', async (req, res, next) => {
  try {
    res.json(await getPublicProfile(validId(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.get('/:id/reputation', async (req, res, next) => {
  try {
    res.json(await getReputation(validId(req.params.id)));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
