import { colors } from './theme';

// Los valores (perdi, hoy, open...) son los de la API; acá solo se traducen para mostrarlos.
export const SITUATIONS = [
  { key: 'perdi', label: 'Perdí algo' },
  { key: 'encontre', label: 'Encontré algo' },
];

export const SITUATION_LABEL = { perdi: 'Perdí', encontre: 'Encontré' };

export const DEFAULT_RADIUS = 1000;
export const RADIUS_OPTIONS = [
  { value: 500, label: '500 m' },
  { value: 1000, label: '1 km' },
  { value: 3000, label: '3 km' },
  { value: 5000, label: '5 km' },
];

// key null = sin filtro de fecha.
export const PERIODS = [
  { key: null, label: 'Cualquiera' },
  { key: 'hoy', label: 'Hoy' },
  { key: '3d', label: '3 días' },
  { key: '7d', label: 'Una semana' },
  { key: 'rango', label: 'Elegir fechas' },
];

export const PERIOD_LABEL = { hoy: 'hoy', '3d': 'últimos 3 días', '7d': 'última semana', rango: 'fechas elegidas' };

export const PUBLICATION_STATUS = {
  open: { label: 'Abierta', color: colors.primary },
  in_claim: { label: 'En reclamo', color: colors.warning },
};
