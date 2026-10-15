import { ApiError } from '../errors';
import { loadDb, saveDb, delay, toPrivateUser, requireCurrentUser } from './db';
import { computeReputation } from './reputation';

export async function getMe() {
  await delay();
  const { user } = await requireCurrentUser();
  return toPrivateUser(user);
}

export async function updateMe({ name, neighborhood, phone, phoneVisibleOnClaim }) {
  await delay();
  const { db, user } = await requireCurrentUser();
  if (name !== undefined) {
    if (!String(name).trim()) throw new ApiError(422, 'El nombre no puede estar vacío.');
    user.name = String(name).trim();
  }
  if (neighborhood !== undefined) user.neighborhood = String(neighborhood).trim();
  if (phone !== undefined) user.phone = String(phone).trim();
  if (phoneVisibleOnClaim !== undefined) user.phoneVisibleOnClaim = !!phoneVisibleOnClaim;
  await saveDb(db);
  return toPrivateUser(user);
}

// En el mock se guarda la URI local. En la API real sería un upload multipart.
export async function uploadPhoto(uri) {
  await delay();
  const { db, user } = await requireCurrentUser();
  user.photoUri = uri;
  await saveDb(db);
  return toPrivateUser(user);
}

// Perfil público: NO incluye email, teléfono ni historial de publicaciones.
export async function getPublicProfile(id) {
  await delay();
  const db = await loadDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new ApiError(404, 'Usuario no encontrado.');
  return {
    id: user.id,
    name: user.name,
    photoUri: user.photoUri,
    memberSince: user.createdAt,
    reputation: computeReputation(user),
  };
}

export async function getReputation(id) {
  await delay();
  const db = await loadDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new ApiError(404, 'Usuario no encontrado.');
  return computeReputation(user);
}
