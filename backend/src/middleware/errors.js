class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Errores de red hacia la base (DNS, conexión rechazada, timeout): el servicio no está disponible, no es un bug.
const DB_DOWN_CODES = new Set(['EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE']);
function isDbUnavailable(err) {
  if (!err) return false;
  if (DB_DOWN_CODES.has(err.code)) return true;
  return typeof err.message === 'string' && /timeout exceeded when trying to connect|Connection terminated/i.test(err.message);
}

function notFound(req, res) {
  res.status(404).json({ message: 'Ruta no encontrada' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El cuerpo no es un JSON válido.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'La solicitud es demasiado grande.' });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (isDbUnavailable(err)) {
    console.error('[db] no disponible:', err.code || err.message);
    res.set('Retry-After', '5');
    return res.status(503).json({ message: 'El servicio no está disponible por un momento. Probá de nuevo en unos segundos.' });
  }
  console.error(err);
  return res.status(500).json({ message: 'Error interno del servidor' });
}

module.exports = { HttpError, notFound, errorHandler, isDbUnavailable };
