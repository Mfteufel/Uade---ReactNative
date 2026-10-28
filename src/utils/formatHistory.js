import { todayInBuenosAires } from './searchCriteria';
import { formatDate } from './formatSearch';

// "2026-10-22T17:42:15.846Z" -> "22/10/2026" (día de Buenos Aires).
export const formatReturnDate = (iso) => (iso ? formatDate(todayInBuenosAires(new Date(iso))) : '');

// Indicadores informativos de una devolución (los botones llegan en el paso E).
export function historyStatus(item) {
  const out = [];
  if (item.myRating) out.push(`Ya valoraste: ${item.myRating.positive ? '👍' : '👎'}`);
  else if (item.canRate) out.push('Podés valorar');
  if (item.role === 'recupere') {
    if (item.thanked) out.push('Agradeciste');
    else if (item.canThank) out.push('Podés agradecer');
  }
  return out;
}
