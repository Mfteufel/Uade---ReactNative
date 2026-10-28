import { USE_MOCK } from '../config';
import api, { unwrap } from './api';

// El buscador solo existe en el backend real (no hay mock): sin API real no hay publicaciones donde buscar.
const requireRealApi = () => {
  if (USE_MOCK) throw new Error('El buscador necesita el backend real (EXPO_PUBLIC_USE_MOCK=false).');
};

// params: los de GET /publicaciones, ya traducidos (tipo lost|found, desde/hasta). Ver utils/searchCriteria.js.
// -> { items, page, limit, hasMore }
export const search = async (params, page = 1) => {
  requireRealApi();
  return api.get('/publicaciones', { params: { ...params, pagina: page } }).then(unwrap);
};

// -> [{ id, tipo, categoria, q, barrio, lat, lng, radio, periodo, desde, hasta, createdAt }]
export const getRecentSearches = async () => {
  requireRealApi();
  return api.get('/busquedas-recientes').then(unwrap);
};

// body: ver toRecentBody(). Si ya existe una idéntica, el servidor solo la sube al principio.
export const saveRecentSearch = async (body) => {
  requireRealApi();
  return api.post('/busquedas-recientes', body).then(unwrap);
};
