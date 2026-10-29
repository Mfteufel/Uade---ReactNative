import api from './api';

export async function followPublication(publicationId) {
  await api.post('/seguidas', { publicacionId: publicationId });
}

export async function unfollowPublication(publicationId) {
  await api.delete(`/seguidas/${publicationId}`);
}
