import { todayInBuenosAires } from './searchCriteria';
import { formatDate } from './formatSearch';

// Tipo de la publicación (ids de PUBLICATION_TYPES) -> etiqueta del historial: chips de filtro y tarjeta.
export const HISTORY_TYPE_LABELS = { lost: 'Perdido', found: 'Encontrado' };

// "2026-10-22T17:42:15.846Z" -> "22/10/2026" (día de Buenos Aires).
export const formatReturnDate = (iso) => (iso ? formatDate(todayInBuenosAires(new Date(iso))) : '');

// Lo que ya pasó con una devolución. Lo que todavía se puede hacer (valorar, agradecer) va como botón en la tarjeta.
export function historyStatus(item) {
  const out = [];
  if (item.myRating) out.push(`Ya valoraste: ${item.myRating.positive ? '👍' : '👎'}`);
  if (item.thanked) out.push(item.role === 'recupere' ? 'Agradeciste' : 'Te agradeció');
  return out;
}
