const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { usersLimiter } = require('../middleware/rateLimit');
const { validPublicationId } = require('../middleware/publicationId');
const { followPublication, unfollowPublication } = require('../services/follows');

const router = Router();
router.use(requireAuth, usersLimiter);

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

module.exports = router;
