const { Router } = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { HttpError } = require('../middleware/errors');
const { toUser } = require('../services/tokens');

const router = Router();

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const r = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (r.rowCount === 0) throw new HttpError(401, 'Sesión inválida. Volvé a iniciar sesión.');
    res.json(toUser(r.rows[0]));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
