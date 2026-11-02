const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { usersLimiter } = require('../middleware/rateLimit');
const { validPublicationId } = require('../middleware/publicationId');
const { followPublication, unfollowPublication, listFollows, markFollowSeen } = require('../services/follows');

const router = Router();
router.use(requireAuth, usersLimiter);

router.get('/', async (req, res, next) => {
  try {
    res.json(await listFollows(req.user.id));
  } catch (e) {
    next(e);
  }
});

// Body: { "publicacionId": "p_..." }
router.post('/', async (req, res, next) => {
  try {
    await followPublication(req.user.id, validPublicationId(req.body?.publicacionId));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.delete('/:publicacionId', async (req, res, next) => {
  try {
    await unfollowPublication(req.user.id, validPublicationId(req.params.publicacionId));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.post('/:publicacionId/vista', async (req, res, next) => {
  try {
    await markFollowSeen(req.user.id, validPublicationId(req.params.publicacionId));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

module.exports = router;
