// Guarda el access token en memoria. AuthContext lo setea al iniciar sesión.
// client.js lo lee para mandar el header Authorization, y el mock para saber quién es el usuario.
// También guarda un callback de renovación: AuthContext lo registra (setRefreshHandler) y
// client.js lo invoca (refreshAccessToken) ante un 401, sin importar React ni SecureStore acá.
let accessToken = null;
let refreshHandler = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

// fn: async () => true si renovó la sesión, false si no. null para sacarla.
export const setRefreshHandler = (fn) => {
  refreshHandler = fn;
};

export const refreshAccessToken = () => {
  if (!refreshHandler) return false;
  return refreshHandler();
};
