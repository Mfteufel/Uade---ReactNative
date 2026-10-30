import AsyncStorage from '@react-native-async-storage/async-storage';

// Guarda la última respuesta buena de la API (con su fecha) para mostrarla sin conexión.
const keyFor = (name) => `hallado_cache_${name}`;

// Copias de cada usuario: se borran al cerrar sesión.
export const myPublicationsCache = (userId) => `mis_publicaciones_${userId}`;
export const lastResultsCache = (userId) => `ultimos_resultados_${userId}`;

export async function readCache(name) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(name));
    return raw ? JSON.parse(raw) : null; // { savedAt, data }
  } catch {
    return null;
  }
}

export const writeCache = (name, data) =>
  AsyncStorage.setItem(keyFor(name), JSON.stringify({ savedAt: new Date().toISOString(), data })).catch(() => {});

export const clearCache = (name) => AsyncStorage.removeItem(keyFor(name));
