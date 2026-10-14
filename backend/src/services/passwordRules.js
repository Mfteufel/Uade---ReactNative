const { HttpError } = require('../middleware/errors');

function assertNewPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) {
    throw new HttpError(422, 'La contraseña debe tener al menos 8 caracteres.');
  }
  if (Buffer.byteLength(pw) > 72) {
    throw new HttpError(422, 'La contraseña no puede superar los 72 caracteres.');
  }
}

module.exports = { assertNewPassword };
