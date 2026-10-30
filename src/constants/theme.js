// Contrastes WCAG (texto normal >= 4.5:1):
// - onPrimary sobre primary (#1565C0): 5.75:1; sobre primaryDark: ~8.6:1.
// - primary sobre primarySoft: ~5.0:1.
// - onPrimary sobre accent (#C24E00): ~4.8:1 (solo Publicar).
// - accentBright (#EF6C00): solo decorativo, sin texto (blanco da 3.08:1).
// - onPrimary sobre danger (#C62828): ~5.6:1.
// - muted (#5F6673) > 5.5:1 sobre background y surface.
export const colors = {
  primary: '#1565C0',
  primaryDark: '#0D47A1', // botón primario presionado
  primarySoft: '#E3F2FD', // chips seleccionados, fila presionada
  accent: '#C24E00', // solo la acción "Publicar" y destacados con texto
  accentBright: '#EF6C00', // solo decorativo, no lleva texto
  danger: '#C62828',
  dangerSoft: '#FDECEA',
  onPrimary: '#FFFFFF',
  success: '#1B5E20',
  successSoft: '#E8F5E9',
  background: '#FFFFFF',
  surface: '#F5F7FA',
  text: '#1B1B1B',
  muted: '#5F6673',
  border: '#D1D5DB',
  error: '#C62828', // = danger
  warning: '#B26A00',
  splash: '#F2F2F0', // fondo del ícono y de la pantalla de carga
  // Estados: siempre con texto (fg sobre bg), nunca solo color.
  status: {
    publication: {
      open: { fg: '#1565C0', bg: '#E3F2FD' },
      in_claim: { fg: '#A84300', bg: '#FFF3E0' },
      resolved: { fg: '#1B5E20', bg: '#E8F5E9' },
      expired: { fg: '#4B5563', bg: '#F3F4F6' },
    },
    claim: {
      pending: { fg: '#A84300', bg: '#FFF3E0' },
      accepted: { fg: '#1B5E20', bg: '#E8F5E9' },
      rejected: { fg: '#B71C1C', bg: '#FDECEA' },
      expired: { fg: '#4B5563', bg: '#F3F4F6' },
    },
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };

export const typography = {
  display: { fontSize: 26, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  small: { fontSize: 14, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '600' },
};

export const shadow = {
  card: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
};

export const touch = { min: 48 };
