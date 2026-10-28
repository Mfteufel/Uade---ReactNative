const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { usersLimiter } = require('../middleware/rateLimit');
const { query } = require('../db');

const router = Router();
router.use(requireAuth, usersLimiter);

// Catálogo de barrios para los formularios (por ahora lo usa "Lo encontré").
router.get('/', async (req, res, next) => {
  try {
    const r = await query('SELECT id, name, locality FROM neighborhoods ORDER BY locality, name');
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
