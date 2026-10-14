import { Image } from 'react-native';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { USE_MOCK } from '../config';
import client from './client';
import * as mock from './mock/mockUsers';

export const getMe = () => (USE_MOCK ? mock.getMe() : client.get('/users/me'));

export const updateMe = (fields) => (USE_MOCK ? mock.updateMe(fields) : client.put('/users/me', fields));

const MAX_SIDE = 1024; // el servidor la achica a 512; con 1024 sobra y sube en un instante

const getImageSize = (uri) =>
  new Promise((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject));

// Las fotos del celular pueden pesar varios MB: las achicamos y re-codificamos a JPEG antes de subir.
async function shrinkForUpload(uri) {
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
  // El fetch de Expo no acepta el formato { uri, name, type } de React Native: la parte del formulario
  // tiene que ser un File de expo-file-system (implementa Blob).
  const form = new FormData();
  form.append('photo', new File(fileUri));
  return client.post('/users/me/photo', form);
};

// Datos que ve otra persona: sin teléfono ni historial.
export const getPublicProfile = (id) =>
  USE_MOCK ? mock.getPublicProfile(id) : client.get(`/users/${id}/public`);

export const getReputation = (id) =>
  USE_MOCK ? mock.getReputation(id) : client.get(`/users/${id}/reputation`);
