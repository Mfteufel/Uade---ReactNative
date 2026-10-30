import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

// Últimas publicaciones que abriste, para verlas sin conexión (detalle, fotos y barrio).
// Solo las que se abrieron, no todo lo que aparece en el buscador.
const MAX_VIEWED = 10;
const keyFor = (userId) => `hallado_publicaciones_vistas_${userId}`;
const photosDir = (userId, id) => new Directory(Paths.document, 'vistas', userId, id);

async function loadList(userId) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Las fotos se bajan a una carpeta de la app: el caché de imágenes no asegura tenerlas sin red.
// Si alguna no baja, queda la URL (se ve cuando vuelve la conexión).
async function downloadPhotos(userId, id, urls) {
  const dir = photosDir(userId, id);
  dir.create({ intermediates: true, idempotent: true });
  const local = [];
  for (const [index, url] of urls.entries()) {
    const target = new File(dir, `foto_${index}.jpg`);
    try {
      if (target.exists) target.delete();
      local.push((await File.downloadFileAsync(url, target)).uri);
    } catch {
      local.push(url);
    }
  }
  return local;
}

function deletePhotos(userId, id) {
  try {
    const dir = photosDir(userId, id);
    if (dir.exists) dir.delete();
  } catch {
    // Si no se borra, ocupa un poco de lugar y nada más.
  }
}

export async function saveViewed(userId, publication) {
  try {
    const remoteUrls = publication.photoUrls || [];
    const all = await loadList(userId);
    const previous = all.find((e) => e.publication.id === publication.id);
    // Si las fotos no cambiaron desde la última vez, no se vuelven a bajar.
    const samePhotos =
      previous &&
      JSON.stringify(previous.remoteUrls) === JSON.stringify(remoteUrls) &&
      previous.publication.photoUrls.every((uri) => uri.startsWith('file:'));
    const photoUrls = samePhotos ? previous.publication.photoUrls : await downloadPhotos(userId, publication.id, remoteUrls);
    // La dirección exacta no se guarda: solo la ve quien tiene un reclamo aceptado (o el dueño).
    const { exactAddress, ...shown } = publication;
    const entry = { savedAt: new Date().toISOString(), remoteUrls, publication: { ...shown, photoUrls } };
    const list = all.filter((e) => e.publication.id !== publication.id);
    const kept = [entry, ...list];
    kept.slice(MAX_VIEWED).forEach((e) => deletePhotos(userId, e.publication.id));
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(kept.slice(0, MAX_VIEWED)));
  } catch {
    // La copia es un extra: si falla, la pantalla anda igual.
  }
}

export async function clearViewed(userId) {
  await AsyncStorage.removeItem(keyFor(userId));
  const dir = new Directory(Paths.document, 'vistas', userId);
  if (dir.exists) dir.delete();
}

// -> { savedAt, publication } o null
export async function getViewed(userId, id) {
  return (await loadList(userId)).find((e) => e.publication.id === id) || null;
}
