import { PERIOD_LABEL, SITUATION_LABEL } from '../constants/search';

// "2026-10-24" -> "24/10/2026" (sin pasar por Date para no correr el día por la zona horaria).
export function formatDate(isoDay) {
  if (!isoDay) return '';
  const [y, m, d] = isoDay.split('-');
  return `${d}/${m}/${y}`;
}

// 850 -> "850 m"; 1234 -> "1,2 km"
export function formatDistance(meters) {
  if (meters === null || meters === undefined) return '';
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

// Resumen de una búsqueda para la lista de recientes: "Perdí · Llaves · "osito" · Palermo · última semana"
export function describeSearch(search, categories, neighborhoods) {
  const parts = [SITUATION_LABEL[search.situacion] || 'Búsqueda'];
  const category = categories.find((c) => c.id === search.categoria);
  if (category) parts.push(category.name);
  if (search.q) parts.push(`"${search.q}"`);
  const hood = neighborhoods.find((n) => n.id === search.barrio);
  if (hood) parts.push(hood.name);
  else if (search.lat != null) parts.push(`cerca tuyo (${formatDistance(search.radio)})`);
  if (search.periodo === 'rango' && search.desde && search.hasta) parts.push(`${formatDate(search.desde)} al ${formatDate(search.hasta)}`);
  else if (search.periodo) parts.push(PERIOD_LABEL[search.periodo]);
  return parts.join(' · ');
}
