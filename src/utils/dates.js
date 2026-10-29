const pad = (n) => String(n).padStart(2, '0');

// Date -> '2026-10-27' (formato que espera la API), con la fecha local del celular.
export const toApiDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// '2026-10-27' -> Date a las 00:00 locales (new Date('2026-10-27') la tomaría en UTC y podría ser el día anterior).
function fromApiDate(apiDate) {
  const [year, month, day] = apiDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const todayApiDate = () => toApiDate(new Date());

export function addDays(apiDate, days) {
  const date = fromApiDate(apiDate);
  date.setDate(date.getDate() + days);
  return toApiDate(date);
}

// Cuántos días pasaron desde esa fecha hasta hoy (0 = hoy).
export const daysAgo = (apiDate) => Math.round((fromApiDate(todayApiDate()) - fromApiDate(apiDate)) / (24 * 60 * 60 * 1000));

// '2026-10-27' -> '27/10/2026'
export function formatApiDate(apiDate) {
  if (!apiDate) return '';
  const [year, month, day] = apiDate.split('-');
  return `${day}/${month}/${year}`;
}

// ISO con hora -> '26/11/2026'
export const formatShortDate = (iso) => new Date(iso).toLocaleDateString('es-AR');

export const daysUntil = (iso) => Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
