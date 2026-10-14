const { Router } = require('express');
const registration = require('../services/registration');
const passwordReset = require('../services/passwordReset');
const session = require('../services/session');
const { loginLimiter, otpLimiter, resetLimiter } = require('../middleware/rateLimit');

const router = Router();

const handler = (fn) => async (req, res, next) => {
  try {
    res.json(await fn(req.body));
  } catch (e) {
    next(e);
  }
};

router.post('/register/request-otp', otpLimiter, handler(registration.requestOtp));
router.post('/register/verify-otp', handler(registration.verifyOtp));
router.post('/register/set-password', handler(registration.setPassword));
router.post('/password/request-otp', otpLimiter, handler(passwordReset.requestOtp));
router.post('/password/resend-otp', otpLimiter, handler(passwordReset.requestOtp));
router.post('/password/reset', resetLimiter, handler(passwordReset.reset));
router.post('/login', loginLimiter, handler(session.login));
router.post('/refresh', handler(session.refresh));

module.exports = router;
