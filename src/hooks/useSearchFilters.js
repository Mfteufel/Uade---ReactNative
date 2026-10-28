import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { getCategoriesCached, getNeighborhoodsCached } from '../services/catalogApi';
import { getErrorMessage } from '../services/errors';
import { DEFAULT_RADIUS } from '../constants/search';

const MAX_SUGGESTIONS = 8;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const EMPTY = {
  situacion: null, // 'perdi' | 'encontre'
  categoria: null,
  q: '',
  barrio: null,
  barrioName: null,
  lat: null,
  lng: null,
  radio: DEFAULT_RADIUS,
  periodo: null, // null | 'hoy' | '3d' | '7d' | 'rango'
  desde: '',
  hasta: '',
};

// Para buscar barrios sin importar mayúsculas ni acentos.
const plain = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Estado de los criterios de búsqueda. Lo usan el buscador guiado y el modal de filtros de los resultados.
// `initial` trae criterios ya cargados (con los nombres de la API).
export default function useSearchFilters(initial = {}) {
  const [values, setValues] = useState({ ...EMPTY, ...initial });
  const [categories, setCategories] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [hoodSearch, setHoodSearch] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const locatingRef = useRef(false); // evita pedir la ubicación dos veces con un doble toque

  const set = useCallback((patch) => setValues((prev) => ({ ...prev, ...patch })), []);

  const loadCatalogs = useCallback(async () => {
    setCatalogError('');
    try {
      const [cats, hoods] = await Promise.all([getCategoriesCached(), getNeighborhoodsCached()]);
      setCategories(cats);
      setNeighborhoods(hoods);
    } catch (e) {
      setCatalogError(getErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    loadCatalogs();
  }, [loadCatalogs]);

  const suggestions = useMemo(() => {
    const text = plain(hoodSearch.trim());
    if (!text) return [];
    return neighborhoods.filter((n) => plain(n.name).includes(text)).slice(0, MAX_SUGGESTIONS);
  }, [hoodSearch, neighborhoods]);

  // Barrio y ubicación son excluyentes: elegir uno borra el otro.
  const selectNeighborhood = (n) => {
    set({ barrio: n.id, barrioName: n.name, lat: null, lng: null });
    setHoodSearch('');
    setLocationError('');
  };
  const clearNeighborhood = () => set({ barrio: null, barrioName: null });
  const clearLocation = () => set({ lat: null, lng: null });

  // El permiso se pide recién acá, cuando la persona toca "Usar mi ubicación".
  const useMyLocation = async () => {
    if (locatingRef.current) return;
    locatingRef.current = true;
    setLocating(true);
    setLocationError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError('Necesitamos permiso para usar tu ubicación. Podés elegir un barrio en su lugar.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setHoodSearch('');
      set({ lat: position.coords.latitude, lng: position.coords.longitude, barrio: null, barrioName: null });
    } catch {
      setLocationError('No pudimos obtener tu ubicación. Revisá que el GPS esté activado o elegí un barrio.');
    } finally {
      locatingRef.current = false;
      setLocating(false);
    }
  };

  // Devuelve el texto del problema o '' si los criterios sirven para buscar.
  const validate = ({ needSituation = true } = {}) => {
    if (needSituation && !values.situacion) return 'Contanos qué te pasó: perdiste o encontraste algo.';
    if (values.periodo === 'rango') {
      if (!DAY_RE.test(values.desde) || !DAY_RE.test(values.hasta)) return 'Las fechas se escriben así: AAAA-MM-DD (ej. 2026-10-24).';
      if (values.desde > values.hasta) return 'La fecha "desde" no puede ser posterior a "hasta".';
    }
    return '';
  };

  // Criterios limpios, con los nombres de la API (sin vacíos). barrioName queda para mostrar.
  const toFilters = () => {
    const f = { situacion: values.situacion };
    if (values.categoria) f.categoria = values.categoria;
    if (values.q.trim()) f.q = values.q.trim();
    if (values.barrio) {
      f.barrio = values.barrio;
      f.barrioName = values.barrioName;
    }
    if (values.lat !== null && values.lng !== null) {
      f.lat = Math.round(values.lat * 1e6) / 1e6;
      f.lng = Math.round(values.lng * 1e6) / 1e6;
      f.radio = values.radio;
    }
    if (values.periodo) {
      f.periodo = values.periodo;
      if (values.periodo === 'rango') {
        f.desde = values.desde;
        f.hasta = values.hasta;
      }
    }
    return f;
  };

  return {
    values, set, categories, neighborhoods, catalogError, reloadCatalogs: loadCatalogs,
    hoodSearch, setHoodSearch, suggestions, selectNeighborhood, clearNeighborhood,
    locating, locationError, useMyLocation, clearLocation,
    validate, toFilters,
  };
}
