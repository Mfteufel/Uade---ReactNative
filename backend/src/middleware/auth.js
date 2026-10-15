const { HttpError } = require('./errors');
const { verifyAccessToken } = require('../services/tokens');

const BEARER_RE = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)$/i;

function parseBearer(header) {
  if (typeof header !== 'string') return null;
  const m = BEARER_RE.exec(header);
  return m ? m[1] : null;
}

function requireAuth(req, res, next) {
  try {
    const token = parseBearer(req.headers.authorization);
    if (!token) throw new HttpError(401, 'Sesión inválida. Volvé a iniciar sesión.');
    req.user = { id: verifyAccessToken(token).userId };
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { parseBearer, requireAuth };
