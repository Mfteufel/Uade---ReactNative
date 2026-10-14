const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || '';

if (!JWT_SECRET) {
  throw new Error(
    'Falta JWT_SECRET en backend/.env. Generá uno con: ' +
      `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
  );
}
if (JWT_SECRET.length < 32) {
  if (isProd) throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción.');
  console.warn('[CONFIG] JWT_SECRET es corto (menos de 32 caracteres). Usá uno más largo.');
}

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || '';
const mailConfigured = Boolean(BREVO_API_KEY && MAIL_FROM);
if (isProd && !mailConfigured) {
  throw new Error('Faltan BREVO_API_KEY / MAIL_FROM en producción: sin ellos no se pueden enviar los códigos por mail.');
}

module.exports = {
  NODE_ENV,
  PORT: process.env.PORT || 3000,
  JWT_SECRET,
  BREVO_API_KEY,
  MAIL_FROM,
  mailConfigured,
};
