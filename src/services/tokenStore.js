// Guarda el access token en memoria. AuthContext lo setea al iniciar sesión.
// El interceptor de api.js lo lee para mandar el header Authorization, y el mock para saber quién es el usuario.
// También guarda un callback de renovación: setupInterceptors (api.js) lo registra con la función
// que le inyecta AuthContext, y el mismo interceptor lo invoca (refreshAccessToken) ante un 401,
// sin importar React ni SecureStore acá.
// La renovación es compartida: si hay una en curso, todos los que la pidan reciben la misma
// promesa, así varios 401 simultáneos hacen un solo refresh (el backend rota el refresh token).
let accessToken = null;
let refreshHandler = null;
let refreshInFlight = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

// fn: async () => true si renovó la sesión, false si no. null para sacarla.
export const setRefreshHandler = (fn) => {
  refreshHandler = fn;
};

export const refreshAccessToken = () => {
  if (!refreshHandler) return Promise.resolve(false);
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = Promise.resolve(refreshHandler()).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};
