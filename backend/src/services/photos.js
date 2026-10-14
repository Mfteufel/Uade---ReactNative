const sharp = require('sharp');
const { withTransaction } = require('../db');
const { HttpError } = require('../middleware/errors');
const { toUser } = require('./tokens');

sharp.concurrency(1);
sharp.cache(false);

const INVALID = 'El archivo no es una imagen válida (JPG, PNG o WEBP).';
const ALLOWED = new Set(['jpeg', 'png', 'webp']);
const MAX_OUT = 300 * 1024;

// Pura: decodifica, valida y re-codifica a JPEG 512 máx. sin metadatos.
function hasImageMagic(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  return b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP';
}

async function processAvatar(buf, { maxPixels = 25_000_000 } = {}) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) throw new HttpError(422, 'La foto está vacía.');
  if (!hasImageMagic(buf)) throw new HttpError(422, INVALID);
  // failOn 'error' (no 'warning'): tolera JPEGs de cámaras con avisos menores pero aborta ante datos corruptos.
  const opts = { limitInputPixels: maxPixels, failOn: 'error' };
  let meta;
  try {
    meta = await sharp(buf, opts).metadata();
  } catch {
    throw new HttpError(422, INVALID);
  }
  if (!ALLOWED.has(meta.format)) throw new HttpError(422, INVALID);
  if (!meta.width || !meta.height || meta.width * meta.height > maxPixels) {
    throw new HttpError(422, 'La imagen es demasiado grande (máximo 25 megapíxeles).');
  }
  if (meta.format === 'png' && meta.isProgressive) throw new HttpError(422, INVALID);
  if ((meta.pages || 1) > 1) throw new HttpError(422, INVALID);
  let out;
  try {
    out = await sharp(buf, opts)
      .rotate()
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new HttpError(422, INVALID);
  }
  if (out.length > MAX_OUT) {
    console.error('[photos] avatar excede el máximo tras procesar:', { bytes: out.length });
    throw new HttpError(500, 'Error interno del servidor');
  }
  return out;
}

async function savePhoto(userId, buf) {
  if (!buf) throw new HttpError(422, 'Elegí una foto para subir.');
  const jpeg = await processAvatar(buf); // fuera de la transacción
  return withTransaction(async (c) => {
    const lock = await c.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (lock.rowCount === 0) throw new HttpError(401, 'Sesión inválida. Volvé a iniciar sesión.');
    const ins = await c.query(
      `INSERT INTO photos (user_id, data, mime) VALUES ($1, $2, 'image/jpeg') RETURNING id`,
      [userId, jpeg]
    );
    const photoId = ins.rows[0].id;
    const upd = await c.query('UPDATE users SET photo_id = $2 WHERE id = $1 RETURNING *', [userId, photoId]);
    await c.query('DELETE FROM photos WHERE user_id = $1 AND id <> $2', [userId, photoId]);
    return toUser(upd.rows[0]);
  });
}

module.exports = { processAvatar, savePhoto };
