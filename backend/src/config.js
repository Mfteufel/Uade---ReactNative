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

// Pura: decide cómo se envían los mails. Prioridad: smtp > brevo > console.
function resolveMailConfig(env = {}) {
  const t = (v) => (typeof v === 'string' ? v.trim() : '');
  const user = t(env.SMTP_USER);
  const pass = t(env.SMTP_PASS);
  const brevoKey = t(env.BREVO_API_KEY);
  const mailFrom = t(env.MAIL_FROM);

  if (user && pass) {
    const rawPort = t(env.SMTP_PORT);
    const port = rawPort === '' ? 465 : Number(rawPort);
    if (!/^\d+$/.test(String(rawPort === '' ? 465 : rawPort)) || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('SMTP_PORT debe ser un entero entre 1 y 65535.');
    }
    return {
      mode: 'smtp',
      smtp: { host: t(env.SMTP_HOST) || 'smtp.gmail.com', port, secure: port === 465, user, pass },
      from: mailFrom || user,
    };
  }
  if (brevoKey && mailFrom) return { mode: 'brevo', from: mailFrom };
  return { mode: 'console', from: mailFrom };
}

const MAIL = resolveMailConfig(process.env);
const MAIL_MODE = MAIL.mode;
const SMTP = MAIL.smtp || null;
const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();
const MAIL_FROM = MAIL.from;
const mailConfigured = MAIL_MODE !== 'console';
if (isProd && !mailConfigured) {
  throw new Error(
    'No hay correo configurado en producción: definí SMTP_USER y SMTP_PASS (Gmail con contraseña de aplicación) ' +
      'o BREVO_API_KEY y MAIL_FROM. Sin eso no se pueden enviar los códigos.'
  );
}
console.log(
  '[CONFIG] Mail: ' +
    (MAIL_MODE === 'smtp' ? `smtp (${SMTP.host}:${SMTP.port})` : MAIL_MODE === 'brevo' ? 'brevo' : 'consola')
);

// Pura: valida y normaliza PUBLIC_URL (base de las URLs de fotos). Nunca se deriva de headers.
function parsePublicUrl(raw, { isProd, port }) {
  let v = typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : '';
  if (!v) {
    if (isProd) throw new Error('Falta PUBLIC_URL en producción (https://tu-dominio).');
    return `http://localhost:${port}`;
  }
  let u;
  try {
    u = new URL(v);
  } catch {
    throw new Error('PUBLIC_URL no es una URL válida.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('PUBLIC_URL debe ser http o https.');
  if (u.username || u.password) throw new Error('PUBLIC_URL no puede tener usuario ni clave.');
  if (u.pathname !== '/' || u.search || u.hash || /[?#]/.test(v)) {
    throw new Error('PUBLIC_URL no puede tener path, query ni hash.');
  }
  if (isProd && u.protocol !== 'https:') throw new Error('PUBLIC_URL debe ser https en producción.');
  return u.origin;
}

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = parsePublicUrl(process.env.PUBLIC_URL, { isProd, port: PORT });
if (!String(process.env.PUBLIC_URL || '').trim()) {
  console.warn(`[CONFIG] Falta PUBLIC_URL; uso ${PUBLIC_URL} (solo desarrollo).`);
}

const TRUST_PROXY = Number.parseInt(process.env.TRUST_PROXY || '0', 10) || 0;

module.exports = {
  TRUST_PROXY,
  NODE_ENV,
  PORT,
  PUBLIC_URL,
  parsePublicUrl,
  JWT_SECRET,
  BREVO_API_KEY,
  MAIL_FROM,
  MAIL_MODE,
  SMTP,
  resolveMailConfig,
  mailConfigured,
};
