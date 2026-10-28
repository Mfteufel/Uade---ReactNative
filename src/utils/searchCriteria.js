// La pantalla habla en "situación" (perdí / encontré) y en "período" (hoy, 3 días...).
// La API habla en `tipo` (lost / found) y en fechas desde/hasta. Acá se traduce de un lado al otro.

// Perdí algo -> hay que mirar lo que otros encontraron (found), y al revés.
export const situacionToTipo = (situacion) => (situacion === 'perdi' ? 'found' : 'lost');
export const tipoToSituacion = (tipo) => (tipo === 'found' ? 'perdi' : 'encontre');

// Argentina no tiene horario de verano: Buenos Aires es siempre UTC-3.
const BUENOS_AIRES_OFFSET_MS = 3 * 60 * 60 * 1000;

// Hoy en Buenos Aires como 'AAAA-MM-DD'.
export const todayInBuenosAires = (now = new Date()) =>
  new Date(now.getTime() - BUENOS_AIRES_OFFSET_MS).toISOString().slice(0, 10);

const addDays = (day, days) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

// periodo -> { desde, hasta } (ambos extremos incluidos). Sin período devuelve {}.
//  hoy: solo hoy. 3d: de hoy-2 a hoy. 7d: de hoy-6 a hoy. rango: las fechas que eligió la persona.
export function periodToRange(periodo, desde, hasta, now = new Date()) {
  const today = todayInBuenosAires(now);
  if (periodo === 'hoy') return { desde: today, hasta: today };
  if (periodo === '3d') return { desde: addDays(today, -2), hasta: today };
  if (periodo === '7d') return { desde: addDays(today, -6), hasta: today };
  if (periodo === 'rango') return { desde, hasta };
  return {};
}

// Criterios de la pantalla -> parámetros de GET /publicaciones.
export function toSearchParams(filters, now = new Date()) {
  const params = { tipo: situacionToTipo(filters.situacion) };
  for (const key of ['categoria', 'q', 'barrio', 'lat', 'lng', 'radio', 'orden']) {
    if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') params[key] = filters[key];
  }
  return { ...params, ...periodToRange(filters.periodo, filters.desde, filters.hasta, now) };
}

// Criterios de la pantalla -> body de POST /busquedas-recientes (el período se guarda tal cual).
export function toRecentBody(filters) {
  const body = { tipo: situacionToTipo(filters.situacion) };
  for (const key of ['categoria', 'q', 'barrio', 'lat', 'lng', 'radio', 'periodo']) {
    if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') body[key] = filters[key];
  }
  if (filters.periodo === 'rango') {
    body.desde = filters.desde;
    body.hasta = filters.hasta;
  }
  return body;
}
