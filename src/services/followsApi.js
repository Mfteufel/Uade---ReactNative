import api from './api';

export async function followPublication(publicationId) {
  await api.post('/seguidas', { publicacionId: publicationId });
}

export async function unfollowPublication(publicationId) {
  await api.delete(`/seguidas/${publicationId}`);
}

// -> [{ id, type, title, status, category, neighborhood, occurredOn, photoUrl, tieneNovedad }]
export async function getFollows() {
  const response = await api.get('/seguidas');
  return response.data;
}

// Ya vio el estado actual: se apaga la novedad.
export async function markFollowSeen(publicationId) {
  await api.post(`/seguidas/${publicationId}/vista`);
}
