import { PUBLICATION_STATUS } from '../constants/search';
import { formatDate, formatDistance } from '../utils/formatSearch';
import ResultCard from './ResultCard';

// Una fila de resultados: adaptador de `item` (la publicación de la API) a ResultCard.
// Mantiene las props de siempre (item, onPress). Sin coordenadas; si hay distancia, va junto a la fecha.
export default function PublicationCard({ item, onPress }) {
  const status = PUBLICATION_STATUS[item.status];
  const hasDistance = item.distanceM !== undefined && item.distanceM !== null;
  const date = item.occurredOn ? `Ocurrió el ${formatDate(item.occurredOn)}` : '';
  const dateText = hasDistance ? [date, `A ${formatDistance(item.distanceM)}`].filter(Boolean).join(' · ') : date;

  return (
    <ResultCard
      title={item.title}
      categoryName={item.category?.name}
      neighborhood={item.neighborhood?.name}
      dateText={dateText}
      photoUri={item.photoUrls?.[0]}
      icon="tag"
      statusLabel={status?.label}
      statusFg={status?.color}
      statusBg={status?.bg}
      onPress={onPress}
    />
  );
}
