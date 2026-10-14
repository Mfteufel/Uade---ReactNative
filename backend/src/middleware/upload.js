const multer = require('multer');
const { HttpError } = require('./errors');

const MAX_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 5, parts: 6, fieldSize: 1024, fieldNameSize: 100, headerPairs: 20 },
});

const TOO_BIG = 'La foto no puede superar los 5 MB.';
const EXTRA = 'El formulario de la foto tiene datos de más.';

const MAX_INFLIGHT = 2;
const UPLOAD_TIMEOUT_MS = Number.parseInt(process.env.UPLOAD_TIMEOUT_MS, 10) || 30_000;

// Pura: error de multer/busboy -> HttpError. Solo loguea code/name/message de lo inesperado.
function mapUploadError(err) {
  if (err instanceof HttpError) return err;
  switch (err && err.code) {
    case 'LIMIT_FILE_SIZE':
      return new HttpError(413, TOO_BIG);
    case 'LIMIT_UNEXPECTED_FILE':
      return new HttpError(400, 'Mandá una sola foto en el campo "photo".');
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_PART_COUNT':
    case 'LIMIT_FIELD_COUNT':
    case 'LIMIT_FIELD_KEY':
    case 'LIMIT_FIELD_VALUE':
      return new HttpError(400, EXTRA);
    default:
      console.error('[upload] error inesperado:', {
        code: err && err.code,
        name: err && err.name,
        message: err && err.message,
      });
      return new HttpError(400, 'El formulario de la foto está mal armado.');
  }
}

// Cierra la conexión después de responder, sin esperar a que el cliente termine de mandar el body.
function closeAfterResponse(req, res) {
  res.set('Connection', 'close');
  res.once('finish', () => req.destroy());
}

function rejectIfTooLarge(req, res, next) {
  const len = Number.parseInt(req.headers['content-length'], 10);
  // Log operativo: solo tamaño declarado y resultado, nunca contenido ni nombres de archivo.
  const sizeTxt = Number.isFinite(len) ? `${len} bytes` : 'sin Content-Length';
  res.once('finish', () => console.log(`[upload] ${res.statusCode} (${sizeTxt})`));
  res.once('close', () => {
    if (!res.writableFinished) console.log(`[upload] conexión cortada antes de responder (${sizeTxt})`);
  });
  if (Number.isFinite(len) && len > MAX_BYTES + 64 * 1024) {
    closeAfterResponse(req, res);
    return next(new HttpError(413, TOO_BIG));
  }
  next();
}

const once = (fn) => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    fn();
  };
};

// Semáforo global + cupo de 1 subida por usuario + timer de subida.
// Se libera UNA vez (req.releaseGate) al terminar todo el trabajo.
function createUploadGate({ maxInflight = MAX_INFLIGHT, timeoutMs = UPLOAD_TIMEOUT_MS } = {}) {
  let inflight = 0;
  const users = new Set();

  function uploadGate(req, res, next) {
    const uid = req.user && req.user.id;
    if (inflight >= maxInflight) {
      closeAfterResponse(req, res);
      res.set('Retry-After', '5');
      return next(new HttpError(503, 'Hay muchas fotos subiéndose. Probá de nuevo en unos segundos.'));
    }
    if (users.has(uid)) {
      closeAfterResponse(req, res);
      return next(new HttpError(429, 'Ya tenés una foto subiéndose. Esperá a que termine.'));
    }
    inflight++;
    users.add(uid);
    let timer = null;
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    req.releaseGate = once(() => {
      clear();
      inflight--;
      users.delete(uid);
    });
    req.photoProcessing = false;
    timer = setTimeout(() => {
      timer = null;
      if (res.headersSent || res.writableEnded) return;
      closeAfterResponse(req, res);
      res.status(408).json({ message: 'La subida tardó demasiado. Probá de nuevo con mejor conexión.' });
    }, timeoutMs);
    if (timer.unref) timer.unref();
    req.on('end', clear); // body completo: ya no corre el timer de subida
    // Si el cliente corta antes de que el handler empiece a procesar, liberamos acá.
    // Si ya está procesando, libera el `finally` del handler.
    res.on('close', () => {
      clear();
      if (!req.photoProcessing) req.releaseGate();
    });
    next();
  }
  return { uploadGate, getInflight: () => inflight, hasUser: (id) => users.has(id) };
}

const defaultGate = createUploadGate();
const uploadGate = defaultGate.uploadGate;

function parsePhoto(req, res, next) {
  if (!req.is('multipart/form-data')) {
    return next(new HttpError(400, 'La foto tiene que enviarse como multipart/form-data.'));
  }
  upload.single('photo')(req, res, (err) => {
    if (res.headersSent || res.writableEnded) return; // ya respondimos (408) o el cliente se fue
    if (!err) return next();
    const mapped = mapUploadError(err);
    if (mapped.status === 413 || mapped.status === 400) closeAfterResponse(req, res);
    next(mapped);
  });
}

module.exports = {
  rejectIfTooLarge,
  uploadGate,
  createUploadGate,
  parsePhoto,
  mapUploadError,
  MAX_INFLIGHT,
  UPLOAD_TIMEOUT_MS,
};
