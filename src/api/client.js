import { API_URL, REQUEST_TIMEOUT_MS } from '../config';
import { ApiError } from './errors';
import { getAccessToken, refreshAccessToken } from './tokenStore';

const GET_RETRIES = 2; // reintentos solo para GET
const RETRY_DELAY_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError(408, 'El servidor tardó demasiado en responder.');
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisá tu conexión.');
  } finally {
    clearTimeout(timer);
  }
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function requestOnce(method, path, body) {
  const headers = { Accept: 'application/json' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const options = { method, headers };
  if (body instanceof FormData) {
    options.body = body; // fetch pone el Content-Type multipart solo
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetchWithTimeout(`${API_URL}${path}`, options);
  const data = await parseBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, data?.message || `Error ${response.status}`);
  }
  return data;
}

async function request(method, path, body) {
  // Reintentos SOLO en GET (son seguros). Nunca en POST/PUT: podrían duplicar la acción.
  const attempts = method === 'GET' ? GET_RETRIES + 1 : 1;
  const send = async () => {
    let lastError;
    for (let i = 0; i < attempts; i++) {
      try {
        return await requestOnce(method, path, body);
      } catch (e) {
        lastError = e;
        const retryable = e.status === 0 || e.status === 408 || e.status >= 500;
        if (!retryable || i === attempts - 1) break;
        await sleep(RETRY_DELAY_MS);
      }
    }
    throw lastError;
  };

  const hadToken = getAccessToken() != null;
  try {
    return await send();
  } catch (e) {
    // Solo un 401 de sesión: había token y no es una ruta /auth/* (esas dan 401 propios).
    if (e.status !== 401 || !hadToken || path.startsWith('/auth/')) throw e;
    if (!(await refreshAccessToken())) throw e;
    // Reintentar un POST/PUT tras 401 es seguro: el servidor lo rechazó antes de hacer nada.
    return send(); // una sola vez: si vuelve a fallar, el error sale tal cual
  }
}

const client = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
};

export default client;
