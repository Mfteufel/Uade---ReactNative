import { Linking } from 'react-native';

// Abre Google Maps (o la app de mapas por defecto) con indicaciones hacia el destino.
// Linking es la única API nativa extra del punto 8: la navegación se hace fuera de Hallado,
// sin mapa embebido ni permisos de ubicación.
export async function openDirections(address) {
  const destination = typeof address === 'string' ? address.trim() : '';
  if (!destination) throw new Error('No hay una dirección para mostrar cómo llegar.');

  // La dirección puede traer espacios, tildes o símbolos: se codifica antes de armar la URL.
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  try {
    await Linking.openURL(url);
  } catch {
    throw new Error('No se pudo abrir la aplicación de mapas.');
  }
}
