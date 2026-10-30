import { USE_MOCK } from '../config';
import api, { unwrap } from './api';
import { getAccessToken } from './tokenStore';
import { shrinkForUpload } from './userApi';

// Los reclamos solo existen en el backend real (no hay mock): sin API real no hay con qué validar
// la respuesta de verificación, el límite de intentos ni el vencimiento.
const requireRealApi = () => {
  if (USE_MOCK) throw new Error('Los reclamos necesitan el backend real (EXPO_PUBLIC_USE_MOCK=false).');
};

// Los ids se codifican al armar la URL para que un valor raro no cambie la ruta pedida.
const enc = encodeURIComponent;

// Las fotos de reclamo son privadas: el servidor las entrega solo con el token de una de las dos partes.
// Se lee el token en el momento de mostrar la imagen (no es un hook, solo lee el almacén en memoria).
export const claimPhotoSource = (uri) => ({ uri, headers: { Authorization: `Bearer ${getAccessToken()}` } });

// Datos del formulario: tipo de reclamo, pregunta de verificación e intentos restantes.
export const getClaimForm = async (publicationId) => {
  requireRealApi();
  return api.get(`/publicaciones/${enc(publicationId)}/reclamos/formulario`).then(unwrap);
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
  return api.post(`/publicaciones/${enc(publicationId)}/reclamos`, fields).then(unwrap);
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
  return api.get(`/reclamos/${enc(claimId)}`).then(unwrap);
};

// Devuelven el reclamo con el estado que quedó en el servidor.
export const acceptClaim = async (claimId) => {
  requireRealApi();
  return api.post(`/reclamos/${enc(claimId)}/aceptar`).then(unwrap);
};

export const rejectClaim = async (claimId) => {
  requireRealApi();
  return api.post(`/reclamos/${enc(claimId)}/rechazar`).then(unwrap);
};

// Punto de encuentro de un reclamo aceptado (punto 8). Las tres devuelven el estado real del servidor.
export const getMeetingPoint = async (claimId) => {
  requireRealApi();
  return api.get(`/reclamos/${enc(claimId)}/punto-encuentro`).then(unwrap);
};

// Sirve para el primer lugar (quien tiene el objeto) y para sugerir otro (la contraparte).
export const proposeMeetingPoint = async (claimId, fields) => {
  requireRealApi();
  return api.post(`/reclamos/${enc(claimId)}/punto-encuentro`, fields).then(unwrap);
};

export const acceptMeetingPoint = async (meetingPointId) => {
  requireRealApi();
  return api.post(`/puntos-encuentro/${enc(meetingPointId)}/aceptar`).then(unwrap);
};

// Quien recupera el objeto confirma la devolución. Devuelve el mismo estado del encuentro, ya con la devolución registrada.
export const confirmReturn = async (claimId) => {
  requireRealApi();
  return api.post(`/reclamos/${enc(claimId)}/devolucion`).then(unwrap);
};
