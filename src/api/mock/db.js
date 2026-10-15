import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '../errors';
import { getAccessToken } from '../tokenStore';
import { SEED_USERS } from './seed';

const DB_KEY = 'hallado:mock:db';

// Simula la demora de red (300-800 ms)
export const delay = () => new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));

// Base de datos del mock: { users: [], otps: {}, registrations: {} }
export async function loadDb() {
  const raw = await AsyncStorage.getItem(DB_KEY);
  if (raw) return JSON.parse(raw);
  const db = { users: SEED_USERS, otps: {}, registrations: {} };
  await saveDb(db);
  return db;
}

export const saveDb = (db) => AsyncStorage.setItem(DB_KEY, JSON.stringify(db));

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const randomString = () => Math.random().toString(36).slice(2, 10);

// Datos del usuario que se pueden mandar a la app (sin contraseña ni estadísticas internas)
export function toPrivateUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    photoUri: u.photoUri,
    neighborhood: u.neighborhood,
    phone: u.phone,
    phoneVisibleOnClaim: u.phoneVisibleOnClaim,
    createdAt: u.createdAt,
  };
}

// Tokens falsos con formato: mock-access.<userId>.<random>
export function createSession(user) {
  return {
    user: toPrivateUser(user),
    accessToken: `mock-access.${user.id}.${randomString()}`,
    refreshToken: `mock-refresh.${user.id}.${randomString()}`,
  };
}

export function userIdFromToken(token, kind) {
  const match = new RegExp(`^mock-${kind}\\.(.+)\\.[a-z0-9]+$`).exec(token || '');
  return match ? match[1] : null;
}

// Equivale a validar el JWT en el backend
export async function requireCurrentUser() {
  const id = userIdFromToken(getAccessToken(), 'access');
  const db = await loadDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new ApiError(401, 'Sesión inválida. Volvé a iniciar sesión.');
  return { db, user };
}
