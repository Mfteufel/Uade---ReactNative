import { ApiError } from '../errors';
import { loadDb, saveDb, normalizeEmail, randomString, createSession, userIdFromToken, delay } from './db';

const OTP_TTL_MS = 10 * 60 * 1000; // expira a los 10 min
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_MS = 60 * 1000; // 60 s entre envíos
const REGISTRATION_TTL_MS = 30 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertEmail(email) {
  if (!EMAIL_REGEX.test(email)) throw new ApiError(422, 'El email no es válido.');
}

function assertPassword(password) {
  if (!password || password.length < 8) throw new ApiError(422, 'La contraseña debe tener al menos 8 caracteres.');
}

// Genera un OTP nuevo (el anterior deja de servir porque se pisa).
function issueOtp(db, purpose, email) {
  const key = `${purpose}:${email}`;
  const previous = db.otps[key];
  const now = Date.now();
  if (previous && now - previous.issuedAt < OTP_RESEND_MS) {
    const wait = Math.ceil((OTP_RESEND_MS - (now - previous.issuedAt)) / 1000);
    throw new ApiError(429, `Esperá ${wait} segundos para pedir otro código.`);
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.otps[key] = { code, issuedAt: now, expiresAt: now + OTP_TTL_MS, attempts: 0 };
  // Solo en modo mock: no hay email real, el código se muestra en consola y en pantalla.
  console.log(`[MOCK OTP] ${purpose} ${email}: ${code}`);
  return {
    message: 'Te enviamos un código de 6 dígitos.',
    expiresInSec: OTP_TTL_MS / 1000,
    resendInSec: OTP_RESEND_MS / 1000,
    devCode: code, // la API real NO devuelve este campo
  };
}

function checkOtp(db, purpose, email, code) {
  const key = `${purpose}:${email}`;
  const otp = db.otps[key];
  if (!otp) throw new ApiError(400, 'Pedí un código primero.');
  if (Date.now() > otp.expiresAt) {
    delete db.otps[key];
    throw new ApiError(410, 'El código venció. Pedí uno nuevo.');
  }
  if (String(code).trim() !== otp.code) {
    otp.attempts += 1;
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      delete db.otps[key];
      throw new ApiError(429, 'Demasiados intentos fallidos. Pedí un código nuevo.');
    }
    const left = OTP_MAX_ATTEMPTS - otp.attempts;
    throw new ApiError(400, `Código incorrecto. Te ${left === 1 ? 'queda 1 intento' : `quedan ${left} intentos`}.`);
  }
  delete db.otps[key]; // el OTP se usa una sola vez
}

// Si un paso falla igual hay que guardar el contador de intentos.
async function withDb(fn) {
  await delay();
  const db = await loadDb();
  try {
    const result = fn(db);
    await saveDb(db);
    return result;
  } catch (e) {
    await saveDb(db);
    throw e;
  }
}

export const requestRegisterOtp = (email) =>
  withDb((db) => {
    email = normalizeEmail(email);
    assertEmail(email);
    if (db.users.some((u) => u.email === email)) throw new ApiError(409, 'Ya existe una cuenta con ese email.');
    return issueOtp(db, 'register', email);
  });

export const verifyRegisterOtp = (email, code) =>
  withDb((db) => {
    email = normalizeEmail(email);
    checkOtp(db, 'register', email, code);
    const registrationToken = `reg-${randomString()}${randomString()}`;
    db.registrations[registrationToken] = { email, expiresAt: Date.now() + REGISTRATION_TTL_MS };
    return { registrationToken };
  });

export const setRegisterPassword = (registrationToken, password) =>
  withDb((db) => {
    const reg = db.registrations[registrationToken];
    if (!reg || Date.now() > reg.expiresAt) throw new ApiError(401, 'El registro venció. Empezá de nuevo.');
    assertPassword(password);
    const user = {
      id: `u_${randomString()}`,
      email: reg.email,
      password,
      name: reg.email.split('@')[0],
      photoUri: null,
      neighborhood: '',
      phone: '',
      phoneVisibleOnClaim: false,
      createdAt: new Date().toISOString(),
      completedReturns: 0,
      positiveRatings: 0,
      negativeRatings: 0,
    };
    db.users.push(user);
    delete db.registrations[registrationToken];
    return createSession(user);
  });

export const login = (email, password) =>
  withDb((db) => {
    email = normalizeEmail(email);
    const user = db.users.find((u) => u.email === email && u.password === password);
    if (!user) throw new ApiError(401, 'Email o contraseña incorrectos.');
    return createSession(user);
  });

export const refresh = (refreshToken) =>
  withDb((db) => {
    const id = userIdFromToken(refreshToken, 'refresh');
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new ApiError(401, 'La sesión venció. Volvé a iniciar sesión.');
    return createSession(user);
  });

export const requestPasswordOtp = (email) =>
  withDb((db) => {
    email = normalizeEmail(email);
    assertEmail(email);
    if (!db.users.some((u) => u.email === email)) throw new ApiError(404, 'No existe una cuenta con ese email.');
    return issueOtp(db, 'reset', email);
  });

export const resendPasswordOtp = requestPasswordOtp; // misma lógica: pisa el código anterior

export const resetPassword = (email, code, newPassword) =>
  withDb((db) => {
    email = normalizeEmail(email);
    assertPassword(newPassword);
    checkOtp(db, 'reset', email, code);
    const user = db.users.find((u) => u.email === email);
    if (!user) throw new ApiError(404, 'No existe una cuenta con ese email.');
    user.password = newPassword;
    return { message: 'Contraseña actualizada.' };
  });
