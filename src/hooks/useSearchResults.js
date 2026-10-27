import { useCallback, useEffect, useRef, useState } from 'react';
import { search } from '../services/searchApi';
import { toSearchParams } from '../utils/searchCriteria';
import { getErrorMessage } from '../services/errors';

const hasCenter = (f) => (f.lat !== undefined && f.lng !== undefined) || !!f.barrio;

// Resultados paginados. El servidor es la fuente de verdad: cada cambio de criterios vuelve a la página 1.
export default function useSearchResults(initialFilters) {
  const [filters, setFilters] = useState({ orden: 'recientes', ...initialFilters });
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0); // número de pedido: una respuesta vieja no pisa a una más nueva
  const busyRef = useRef(false); // evita pedir la misma página dos veces

  // mode: 'first' (pantalla nueva o filtros nuevos) | 'refresh' (pull-to-refresh) | 'more' (página siguiente)
  const run = useCallback(async (f, pageNumber, mode) => {
    const id = ++requestRef.current;
    busyRef.current = true;
    if (mode === 'more') setLoadingMore(true);
    else if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await search(toSearchParams(f), pageNumber); // situación y período -> tipo y fechas
      if (id !== requestRef.current) return;
      setItems((prev) => {
        if (mode !== 'more') return res.items;
        const seen = new Set(prev.map((item) => item.id)); // si se publicó algo en el medio, la página se corre
        return [...prev, ...res.items.filter((item) => !seen.has(item.id))];
      });
      setPage(res.page);
      setHasMore(res.hasMore);
    } catch (e) {
      if (id === requestRef.current) setError(getErrorMessage(e));
    } finally {
      if (id === requestRef.current) {
        busyRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    run(filters, 1, 'first');
    // Solo al abrir la pantalla: los cambios posteriores pasan por applyFilters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (next) => {
    // "Cercanos" no tiene sentido sin ubicación ni barrio.
    const fixed = next.orden === 'cercanos' && !hasCenter(next) ? { ...next, orden: 'recientes' } : next;
    setFilters(fixed);
    setItems([]);
    setHasMore(false);
    run(fixed, 1, 'first');
  };

  const setOrder = (orden) => {
    if (orden === filters.orden) return;
    applyFilters({ ...filters, orden });
  };

  const loadMore = () => {
    if (busyRef.current || !hasMore || error) return;
    run(filters, page + 1, 'more');
  };

  const refresh = () => run(filters, 1, 'refresh');
  const retry = () => run(filters, 1, items.length === 0 ? 'first' : 'refresh');

  return {
    filters, items, hasMore, loading, loadingMore, refreshing, error,
    canSortByDistance: hasCenter(filters),
    applyFilters, setOrder, loadMore, refresh, retry,
  };
}
