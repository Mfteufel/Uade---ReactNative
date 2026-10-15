// Guarda el access token en memoria. AuthContext lo setea al iniciar sesión.
// client.js lo lee para mandar el header Authorization, y el mock para saber quién es el usuario.
let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;
