class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
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
  console.error(err);
  return res.status(500).json({ message: 'Error interno del servidor' });
}

module.exports = { HttpError, notFound, errorHandler };
