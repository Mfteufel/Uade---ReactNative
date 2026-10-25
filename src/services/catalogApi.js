import api, { unwrap } from './api';

// Barrios para elegir en los formularios: [{ id, name, locality }]
export const getNeighborhoods = () => api.get('/barrios').then(unwrap);
