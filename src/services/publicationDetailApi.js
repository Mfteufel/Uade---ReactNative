import api from './api';

export async function getPublication(id) {
  const response = await api.get(`/publicaciones/${id}`);
  return response.data;
}
