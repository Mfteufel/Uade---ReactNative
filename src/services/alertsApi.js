import api from './api';

// -> [{ id, tipo, categoria: { id, name } | null, barrio: { id, name } | null, q, pausada, cantidadNuevas, createdAt }]
export async function getAlerts() {
  const response = await api.get('/alertas');
  return response.data;
}

// body: { tipo, categoria?, q?, barrio? } (ver toAlertBody en utils/searchCriteria.js)
export async function createAlert(body) {
  const response = await api.post('/alertas', body);
  return response.data;
}

export async function setAlertPaused(id, pausada) {
  await api.post(`/alertas/${id}/pausa`, { pausada });
}

export async function deleteAlert(id) {
  await api.delete(`/alertas/${id}`);
}

// Las publicaciones nuevas de la alerta pasan a vistas (el contador vuelve a 0).
export async function markAlertSeen(id) {
  await api.post(`/alertas/${id}/vista`);
}
