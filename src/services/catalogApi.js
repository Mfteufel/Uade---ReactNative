import api, { unwrap } from './api';

// Barrios para elegir en los formularios: [{ id, name, locality }]
export const getNeighborhoods = () => api.get('/barrios').then(unwrap);

// Categorías para el buscador y los formularios: [{ id, name }] en el orden del catálogo.
export const getCategories = () => api.get('/categorias').then(unwrap);
