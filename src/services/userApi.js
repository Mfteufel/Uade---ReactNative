import { Image } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { USE_MOCK } from '../config';
import api, { unwrap } from './api';
import * as mock from './mock/mockUsers';

export const getMe = () => (USE_MOCK ? mock.getMe() : api.get('/users/me').then(unwrap));

export const updateMe = (fields) => (USE_MOCK ? mock.updateMe(fields) : api.put('/users/me', fields).then(unwrap));

const MAX_SIDE = 1024; // el servidor la achica a 512; con 1024 sobra y sube en un instante

const getImageSize = (uri) =>
  new Promise((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject));

// Las fotos del celular pueden pesar varios MB: las achicamos y re-codificamos a JPEG antes de subir.
export async function shrinkForUpload(uri) {
  const { width, height } = await getImageSize(uri);
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const context = ImageManipulator.manipulate(uri);
  if (scale < 1) {
    context.resize({ width: Math.round(width * scale), height: Math.round(height * scale) });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  context.release(); // liberar memoria nativa
  image.release();
  return result.uri;
}

export const uploadPhoto = async (uri) => {
  if (USE_MOCK) return mock.uploadPhoto(uri);
  let fileUri = uri;
  try {
    fileUri = await shrinkForUpload(uri);
  } catch {
    // Si no se pudo achicar, probamos con la original: el servidor avisa si no sirve.
  }
  // Axios en React Native usa XMLHttpRequest: la parte del formulario va como { uri, name, type }.
  // No se setea Content-Type a mano: así se arma el boundary del multipart.
  const form = new FormData();
  form.append('photo', { uri: fileUri, name: 'photo.jpg', type: 'image/jpeg' });
  return api.post('/users/me/photo', form).then(unwrap);
};

// Datos que ve otra persona: sin teléfono ni historial.
export const getPublicProfile = (id) =>
  USE_MOCK ? mock.getPublicProfile(id) : api.get(`/users/${id}/public`).then(unwrap);

export const getReputation = (id) =>
  USE_MOCK ? mock.getReputation(id) : api.get(`/users/${id}/reputation`).then(unwrap);
