// Mismo formato que devolvería la API real: { status, message }
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Status HTTP de un error: Axios lo trae en e.response.status; el mock tira ApiError con e.status.
// Devuelve 0 si no hubo respuesta (sin red, timeout).
export function getErrorStatus(error) {
  return error?.response?.status ?? error?.status ?? 0;
}

// El pedido no llegó a tener respuesta: sin red, servidor caído o timeout.
export const isNetworkError = (error) => !!error?.isAxiosError && !error.response;

// Para usar en las pantallas: siempre devuelve un texto mostrable.
export function getErrorMessage(error) {
  const fromServer = error?.response?.data?.message;
  if (fromServer) return fromServer;
  if (error?.code === 'ECONNABORTED') return 'El servidor tardó demasiado en responder.';
  if (error?.isAxiosError && !error.response) {
    return 'No se pudo conectar con el servidor. Revisá tu conexión.';
  }
  return error?.message || 'Ocurrió un error inesperado. Intentá de nuevo.';
}
