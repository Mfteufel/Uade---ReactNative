import { USE_MOCK } from '../config';
import client from './client';
import * as mock from './mock/mockUsers';

export const getMe = () => (USE_MOCK ? mock.getMe() : client.get('/users/me'));

export const updateMe = (fields) => (USE_MOCK ? mock.updateMe(fields) : client.put('/users/me', fields));

export const uploadPhoto = (uri) => {
  if (USE_MOCK) return mock.uploadPhoto(uri);
  const form = new FormData();
  form.append('photo', { uri, name: 'photo.jpg', type: 'image/jpeg' });
  return client.post('/users/me/photo', form);
};

// Datos que ve otra persona: sin teléfono ni historial.
export const getPublicProfile = (id) =>
  USE_MOCK ? mock.getPublicProfile(id) : client.get(`/users/${id}/public`);

export const getReputation = (id) =>
  USE_MOCK ? mock.getReputation(id) : client.get(`/users/${id}/reputation`);
