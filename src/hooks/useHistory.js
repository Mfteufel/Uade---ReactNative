import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getHistory } from '../services/historyApi';
import { getCategoriesCached } from '../services/catalogApi';
import { getErrorMessage } from '../services/errors';
import { dayRangeError } from '../utils/searchCriteria';

const NO_FILTERS = { desde: '', hasta: '', categoria: null };

// "Mi historial": devoluciones paginadas, separadas por rol, con filtros de fechas y categoría.
// Se vuelve a pedir al recuperar el foco, así canRate / canThank nunca quedan viejos.
export default function useHistory() {
  const [rol, setRolState] = useState('devolvi'); // 'devolvi' | 'recupere'
  const [applied, setApplied] = useState(NO_FILTERS); // filtros en uso
  const [draft, setDraft] = useState({ desde: '', hasta: '' }); // fechas que se están escribiendo
  const [filterError, setFilterError] = useState('');
  const [categories, setCategories] = useState([]);

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const requestRef = useRef(0); // número de pedido: una respuesta vieja no pisa a una más nueva
  const busyRef = useRef(false); // evita pedir la misma página dos veces (doble toque / onEndReached repetido)
  const queryRef = useRef({ rol: 'devolvi', ...NO_FILTERS }); // lo último pedido, para recargar al volver
  const loadedRef = useRef(false);

  // mode: 'first' (rol o filtros nuevos) | 'refresh' (pull-to-refresh o volver a la pantalla) | 'more'
  const run = useCallback(async (q, pageNumber, mode) => {
    const id = ++requestRef.current;
    queryRef.current = q;
    busyRef.current = true;
    if (mode === 'more') setLoadingMore(true);
    else if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await getHistory(q, pageNumber);
      if (id !== requestRef.current) return;
      setItems((prev) => {
        if (mode !== 'more') return res.items;
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...res.items.filter((item) => !seen.has(item.id))];
      });
      setPage(res.page);
      setHasMore(res.hasMore);
      loadedRef.current = true;
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

  // Al abrir y al volver (por ejemplo, desde un perfil): la primera vez carga, después refresca sin vaciar la lista.
  useFocusEffect(
    useCallback(() => {
      run(queryRef.current, 1, loadedRef.current ? 'refresh' : 'first');
    }, [run])
  );

  // Categorías del catálogo (cacheadas por sesión). Si fallan, simplemente no se muestran los chips.
  useEffect(() => {
    getCategoriesCached().then(setCategories).catch(() => setCategories([]));
  }, []);

  const reload = (next) => {
    setItems([]);
    setHasMore(false);
    run(next, 1, 'first');
  };

  const setRol = (next) => {
    if (next === rol) return;
    setRolState(next);
    reload({ ...queryRef.current, rol: next });
  };

  const setCategoria = (categoria) => {
    const next = { ...applied, categoria: categoria === applied.categoria ? null : categoria };
    setApplied(next);
    reload({ ...queryRef.current, categoria: next.categoria });
  };

  const applyDates = () => {
    const desde = draft.desde.trim();
    const hasta = draft.hasta.trim();
    const problem = dayRangeError(desde, hasta, { required: false });
    setFilterError(problem);
    if (problem) return;
    setApplied({ ...applied, desde, hasta });
    reload({ ...queryRef.current, desde, hasta });
  };

  const clearFilters = () => {
    setDraft({ desde: '', hasta: '' });
    setFilterError('');
    setApplied(NO_FILTERS);
    reload({ rol, ...NO_FILTERS });
  };

  const loadMore = () => {
    if (busyRef.current || !hasMore || error) return;
    run(queryRef.current, page + 1, 'more');
  };

  const refresh = () => run(queryRef.current, 1, 'refresh');
  const retry = () => run(queryRef.current, 1, items.length === 0 ? 'first' : 'refresh');

  const hasFilters = Boolean(applied.desde || applied.hasta || applied.categoria || draft.desde || draft.hasta);

  return {
    rol, setRol, applied, draft, setDraft, filterError, categories, hasFilters,
    setCategoria, applyDates, clearFilters,
    items, hasMore, loading, loadingMore, refreshing, error,
    loadMore, refresh, retry,
  };
}
