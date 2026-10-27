import { USE_MOCK } from '../config';
import api, { unwrap } from './api';
import { shrinkForUpload } from './userApi';

// Los reclamos solo existen en el backend real (no hay mock): sin API real no hay con qué validar
// la respuesta de verificación, el límite de intentos ni el vencimiento.
const requireRealApi = () => {
  if (USE_MOCK) throw new Error('Los reclamos necesitan el backend real (EXPO_PUBLIC_USE_MOCK=false).');
};

// Datos del formulario: tipo de reclamo, pregunta de verificación e intentos restantes.
export const getClaimForm = async (publicationId) => {
  requireRealApi();
  return api.get(`/publicaciones/${publicationId}/reclamos/formulario`).then(unwrap);
};

// La foto se sube primero y el reclamo la referencia con el photoId que devuelve el servidor.
export const uploadClaimPhoto = async (uri) => {
  requireRealApi();
  let fileUri = uri;
  try {
    fileUri = await shrinkForUpload(uri);
  } catch {
    // Si no se pudo achicar, probamos con la original: el servidor avisa si no sirve.
  }
  const form = new FormData();
  form.append('photo', { uri: fileUri, name: 'photo.jpg', type: 'image/jpeg' });
  return api.post('/reclamos/foto', form).then(unwrap);
};

export const createClaim = async (publicationId, fields) => {
  requireRealApi();
  return api.post(`/publicaciones/${publicationId}/reclamos`, fields).then(unwrap);
};

export const getSentClaims = async () => {
  requireRealApi();
  return api.get('/reclamos/enviados').then(unwrap);
};

export const getReceivedClaims = async () => {
  requireRealApi();
  return api.get('/reclamos/recibidos').then(unwrap);
};

export const getClaim = async (claimId) => {
  requireRealApi();
  return api.get(`/reclamos/${claimId}`).then(unwrap);
};

// Devuelven el reclamo con el estado que quedó en el servidor.
export const acceptClaim = async (claimId) => {
  requireRealApi();
  return api.post(`/reclamos/${claimId}/aceptar`).then(unwrap);
};

export const rejectClaim = async (claimId) => {
  requireRealApi();
  return api.post(`/reclamos/${claimId}/rechazar`).then(unwrap);
};
