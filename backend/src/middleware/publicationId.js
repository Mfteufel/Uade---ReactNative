const { HttpError } = require('./errors');

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Mismo formato de id que las otras rutas: si no coincide, ni se consulta la base.
function validPublicationId(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new HttpError(404, 'Publicación no encontrada.');
  return id;
}

module.exports = { validPublicationId };
