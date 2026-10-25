// "24/10/2026 10:30" a partir de una fecha ISO que manda la API.
export function formatDateTime(isoDate) {
  return new Date(isoDate).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
