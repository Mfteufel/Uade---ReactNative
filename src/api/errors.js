// Mismo formato que devolvería la API real: { status, message }
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Para usar en las pantallas: siempre devuelve un texto mostrable.
export function getErrorMessage(error) {
  return error?.message || 'Ocurrió un error inesperado. Intentá de nuevo.';
}
