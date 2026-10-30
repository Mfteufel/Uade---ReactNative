import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

// Publicaciones creadas sin conexión que todavía no llegaron al servidor. Una lista por usuario.
// Cada una: { clientId, body, photoUris, neighborhoodName, createdAt, error }
const keyFor = (userId) => `hallado_publicaciones_pendientes_${userId}`;

const photosDir = (clientId) => new Directory(Paths.document, 'pendientes', clientId);

export async function loadPending(userId) {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  return raw ? JSON.parse(raw) : [];
}

const savePending = (userId, list) => AsyncStorage.setItem(keyFor(userId), JSON.stringify(list));

// Las fotos del picker quedan en el caché, que Android puede borrar. Como la publicación puede
// esperar días a que vuelva la red, las copiamos a una carpeta de la app.
async function keepPhotos(clientId, uris) {
  const dir = photosDir(clientId);
  dir.create({ intermediates: true, idempotent: true });
  const kept = [];
  for (const [index, uri] of uris.entries()) {
    const target = new File(dir, `foto_${index}.jpg`);
    if (target.exists) target.delete();
    await new File(uri).copy(target);
    kept.push(target.uri);
  }
  return kept;
}

export function deletePhotos(clientId) {
  const dir = photosDir(clientId);
  if (dir.exists) dir.delete();
}

export async function addPending(userId, { body, photoUris, neighborhoodName }) {
  const item = {
    clientId: body.clientId,
    body,
    photoUris: await keepPhotos(body.clientId, photoUris),
    neighborhoodName,
    createdAt: new Date().toISOString(),
    error: null,
  };
  // Si ya estaba (mismo borrador), la reemplazamos.
  const list = (await loadPending(userId)).filter((p) => p.clientId !== item.clientId);
  await savePending(userId, [item, ...list]);
  return item;
}

export async function removePending(userId, clientId) {
  const list = await loadPending(userId);
  await savePending(userId, list.filter((p) => p.clientId !== clientId));
}

// Al cerrar sesión: se borran las que no se mandaron, con sus fotos (traen la respuesta y la dirección).
export async function clearPending(userId) {
  for (const item of await loadPending(userId)) deletePhotos(item.clientId);
  await AsyncStorage.removeItem(keyFor(userId));
}

// El servidor la rechazó (un dato inválido, por ejemplo): esa no se reintenta sola.
export async function markFailed(userId, clientId, message) {
  const list = await loadPending(userId);
  await savePending(userId, list.map((p) => (p.clientId === clientId ? { ...p, error: message } : p)));
}
