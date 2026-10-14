const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { usersLimiter } = require('../middleware/rateLimit');
const profile = require('../services/profile');

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

module.exports = router;
