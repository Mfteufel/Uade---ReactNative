import api, { unwrap } from './api';

// Barrios para elegir en los formularios: [{ id, name, locality }]
export const getNeighborhoods = () => api.get('/barrios').then(unwrap);

// Categorías para el buscador y los formularios: [{ id, name }] en el orden del catálogo.
export const getCategories = () => api.get('/categorias').then(unwrap);

// Catálogos que no cambian durante la sesión: se piden una sola vez y el modal de filtros reutiliza la respuesta.
// Si el pedido falla no se guarda, así el próximo intento vuelve a pedirlo.
const once = (load) => {
  let promise = null;
  return () => {
    if (!promise) promise = load().catch((e) => { promise = null; throw e; });
    return promise;
  };
};
export const getCategoriesCached = once(getCategories);
export const getNeighborhoodsCached = once(getNeighborhoods);
