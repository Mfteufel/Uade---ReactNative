import { USE_MOCK } from '../config';
import api, { unwrap } from './api';
import { shrinkForUpload } from './userApi';
import { getNeighborhoods } from './catalogApi';
import { isNetworkError } from './errors';
import { readCache, writeCache } from './offlineCache';
import { delay } from './mock/db';
import { MOCK_NEIGHBORHOODS } from './mock/catalog';
import * as mock from './mock/mockPublications';

// Barrios para el paso "¿Dónde?". Con el mock se usa una lista corta con los mismos ids del backend.
// Se guarda la última lista que llegó: sin ella no se podría publicar sin conexión.
export async function getNeighborhoodsForPublish() {
  if (USE_MOCK) {
    await delay();
    return MOCK_NEIGHBORHOODS;
  }
  try {
    const list = await getNeighborhoods();
    writeCache('barrios', list);
    return list;
  } catch (e) {
    const cached = isNetworkError(e) ? await readCache('barrios') : null;
    if (cached) return cached.data;
    throw e;
  }
}

async function uploadPublicationPhoto(uri) {
  let fileUri = uri;
  try {
    fileUri = await shrinkForUpload(uri);
  } catch {
    // Si no se pudo achicar, probamos con la original: el servidor avisa si no sirve.
  }
  const form = new FormData();
  form.append('photo', { uri: fileUri, name: 'photo.jpg', type: 'image/jpeg' });
  const { photoId } = await api.post('/publicaciones/fotos', form).then(unwrap);
  return photoId;
}

// Primero sube las fotos (de a una: el servidor acepta una subida por persona a la vez) y después crea
// la publicación con sus ids. Si falla a mitad de camino se puede reintentar: el clientId evita duplicados.
export async function createPublication(body, photoUris) {
  if (USE_MOCK) return mock.createPublication(body, photoUris);
  const photoIds = [];
  for (const uri of photoUris) {
    photoIds.push(await uploadPublicationPhoto(uri));
  }
  return api.post('/publicaciones', { ...body, photoIds }).then(unwrap);
}

export const getMyPublications = () =>
  USE_MOCK ? mock.getMyPublications() : api.get('/publicaciones/mias').then(unwrap);

export const renewPublication = (id) =>
  USE_MOCK ? mock.renewPublication(id) : api.post(`/publicaciones/${id}/renovar`).then(unwrap);
