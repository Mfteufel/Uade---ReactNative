const { Router } = require('express');
const registration = require('../services/registration');

const router = Router();

const handler = (fn) => async (req, res, next) => {
  try {
    res.json(await fn(req.body));
  } catch (e) {
    next(e);
  }
};

router.post('/register/request-otp', handler(registration.requestOtp));
router.post('/register/verify-otp', handler(registration.verifyOtp));
router.post('/register/set-password', handler(registration.setPassword));

module.exports = router;
