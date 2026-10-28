import { USE_MOCK } from '../config';
import api, { unwrap } from './api';

// El historial solo existe en el backend real (no hay mock).
const requireRealApi = () => {
  if (USE_MOCK) throw new Error('El historial necesita el backend real (EXPO_PUBLIC_USE_MOCK=false).');
};

// filters: { rol: 'devolvi'|'recupere', desde?, hasta?, categoria? } (vacíos se omiten).
// -> { items, page, limit, hasMore }. Ver GET /historial en API_CONTRACT.md.
export const getHistory = async (filters, page = 1) => {
  requireRealApi();
  const params = { pagina: page };
  for (const key of ['rol', 'desde', 'hasta', 'categoria']) {
    if (filters[key]) params[key] = filters[key];
  }
  return api.get('/historial', { params }).then(unwrap);
};
