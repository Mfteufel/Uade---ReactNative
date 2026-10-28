import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getRecentSearches } from '../services/searchApi';
import { getErrorMessage } from '../services/errors';
import { tipoToSituacion } from '../utils/searchCriteria';
import useSearchFilters from './useSearchFilters';

// Criterios guardados -> criterios de búsqueda (con los nombres de la API, sin nulos).
const fromRecent = (recent, neighborhoods) => {
  const f = { situacion: recent.situacion };
  for (const key of ['categoria', 'q', 'barrio', 'lat', 'lng', 'radio', 'periodo', 'desde', 'hasta']) {
    if (recent[key] !== null && recent[key] !== undefined) f[key] = recent[key];
  }
  const hood = neighborhoods.find((n) => n.id === recent.barrio);
  if (hood) f.barrioName = hood.name;
  return f;
};

// Buscador guiado: criterios, búsquedas recientes y el paso a los resultados.
export default function useSearchScreen(navigation) {
  const filters = useSearchFilters();
  const [recents, setRecents] = useState([]);
  const [recentsError, setRecentsError] = useState('');
  const [error, setError] = useState('');

  const loadRecents = useCallback(async () => {
    setRecentsError('');
    try {
      const list = await getRecentSearches();
      setRecents(list.map((recent) => ({ ...recent, situacion: tipoToSituacion(recent.tipo) })));
    } catch (e) {
      setRecentsError(getErrorMessage(e));
    }
  }, []);

  // Al volver de los resultados, la lista muestra la búsqueda recién guardada.
  useFocusEffect(
    useCallback(() => {
      loadRecents();
    }, [loadRecents])
  );

  // La búsqueda reciente se guarda en los resultados, recién cuando la primera página responde bien.
  const go = (criteria) => navigation.navigate('Results', { filters: criteria });

  const onSearch = () => {
    const problem = filters.validate();
    if (problem) return setError(problem);
    go(filters.toFilters());
  };

  const onRepeat = (recent) => go(fromRecent(recent, filters.neighborhoods));

  return { filters, recents, recentsError, loadRecents, error, onSearch, onRepeat };
}
