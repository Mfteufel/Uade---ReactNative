import axios from 'axios';
import { API_URL, REQUEST_TIMEOUT_MS } from '../config';
import { getErrorStatus } from './errors';
import { getJwtExp } from '../utils/jwt';
import { getAccessToken, refreshAccessToken, setRefreshHandler } from './tokenStore';

const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

// Las funciones de authApi/userApi devuelven solo el cuerpo de la respuesta.
export const unwrap = (res) => res.data;

const REFRESH_MARGIN_MS = 30 * 1000; // renovar si el token vence en menos de esto
const MAX_GET_RETRIES = 2;
const RETRY_DELAY_MS = 500;

const isAuthRoute = (config) => (config.url || '').startsWith('/auth/');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Registra los interceptores una sola vez. AuthContext inyecta las funciones (acá no hay React):
// refresh: async () => true si renovó la sesión, false si no; lanza el error si el refresh falló.
// logout: cierra la sesión (se usa cuando la renovación da 401).
// Devuelve una función que los saca (para el cleanup del useEffect).
let ejectPrevious = null;
export function setupInterceptors({ refresh, logout }) {
  if (ejectPrevious) ejectPrevious();
  setRefreshHandler(refresh);

  // Renueva (con la promesa compartida). Si el refresh da 401, la sesión murió: logout.
  const tryRefresh = async () => {
    try {
      return await refreshAccessToken();
    } catch (e) {
      if (getErrorStatus(e) === 401) await logout();
      return false;
    }
  };

  const reqId = api.interceptors.request.use(async (config) => {
    if (isAuthRoute(config)) return config;
    let token = getAccessToken();
    if (!token) return config;
    const exp = getJwtExp(token);
    if (exp && exp - Date.now() < REFRESH_MARGIN_MS) {
      await tryRefresh();
      token = getAccessToken() || token;
    }
    config.headers.Authorization = `Bearer ${token}`;
    config._sentToken = token;
    return config;
  });

  const resId = api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const config = error.config;
      if (!config) return Promise.reject(error);
      const status = error.response?.status;

      // (a) Reintento de GET ante falta de respuesta, timeout o 5xx. Nunca POST/PUT.
      const transient = !error.response || error.code === 'ECONNABORTED' || status >= 500;
      if (transient && (config.method || 'get').toLowerCase() === 'get') {
        config._retryCount = config._retryCount || 0;
        if (config._retryCount < MAX_GET_RETRIES) {
          config._retryCount += 1;
          await sleep(RETRY_DELAY_MS);
          return api(config);
        }
      }

      // (b) 401: renovar el token y reintentar una sola vez.
      if (status === 401 && config._sentToken && !isAuthRoute(config) && !config._retried) {
        config._retried = true;
        // Si otro pedido ya renovó el token, alcanza con reintentar.
        if (getAccessToken() !== config._sentToken || (await tryRefresh())) return api(config);
      }
      return Promise.reject(error);
    },
  );

  ejectPrevious = () => {
    api.interceptors.request.eject(reqId);
    api.interceptors.response.eject(resId);
    setRefreshHandler(null);
    ejectPrevious = null;
  };
  return ejectPrevious;
}

export default api;
