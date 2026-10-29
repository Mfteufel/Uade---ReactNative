import { Linking } from 'react-native';

function validCoords(latitude, longitude) {
  return (
    typeof latitude === 'number' && typeof longitude === 'number' &&
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
  );
}

// Arma la URL de Google Maps en modo navegación. Prefiere las coordenadas del punto de encuentro
// (si son válidas) y, si no hay, usa la dirección de texto. Devuelve null si no hay ninguna.
export function buildDirectionsUrl(point) {
  const { address, latitude, longitude } =
    typeof point === 'string' ? { address: point } : point || {};
  let destination = '';
  if (validCoords(latitude, longitude)) destination = `${latitude},${longitude}`;
  else if (typeof address === 'string') destination = address.trim();
  if (!destination) return null;
  // El destino puede traer espacios, tildes o símbolos: se codifica antes de armar la URL.
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&dir_action=navigate`;
}

// Abre Google Maps (o la app de mapas por defecto) para navegar hasta el punto de encuentro.
// Recibe el punto ({ address, latitude, longitude }) o directamente una dirección en texto.
// Linking es la única API nativa extra del punto 8: la navegación se hace fuera de Hallado,
// sin mapa embebido ni permisos de ubicación.
export async function openDirections(point) {
  const url = buildDirectionsUrl(point);
  if (!url) throw new Error('No hay una dirección para mostrar cómo llegar.');
  try {
    await Linking.openURL(url);
  } catch {
    throw new Error('No se pudo abrir la aplicación de mapas.');
  }
}
