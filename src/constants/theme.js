// Tokens de DISENO_UI.md. Las claves viejas se conservan y apuntan al mismo valor
// que las claves nuevas del diseño (alias), para no romper pantallas existentes.
//
// Contrastes WCAG (texto normal >= 4.5:1):
// - blanco sobre blue600 (#1565C0): 5.74:1; sobre blue800: ~8.6:1.
// - blue600 sobre blue50: ~5.0:1.
// - blanco sobre accent700 (#C24E00): 4.79:1 (solo los 3 lugares del diseño).
// - accent500 (#EF6C00): solo decorativo, sin texto (blanco da 3.08:1).
// - textDim (#5F6673) > 5.5:1 sobre bg y sobre surface.
// - textDim sobre neutral200 (botón deshabilitado): 4.66:1.
// - blanco sobre danger (#C62828): ~5.6:1.
const blue600 = '#1565C0';
const blue800 = '#0D47A1';
const blue50 = '#E3F2FD';
const accent700 = '#C24E00';
const accent800 = '#A84300';
const accent500 = '#EF6C00';
const textDim = '#5F6673';
const danger = '#C62828';
const danger800 = '#B71C1C';
const warnSoft = '#FFF3E0';

export const colors = {
  // Nombres del diseño
  blue600,
  blue800,
  blue50,
  accent700, // relleno naranja con texto blanco: solo 3 lugares
  accent800, // naranja presionado; tinta de «En reclamo»
  accent500, // jamás lleva texto encima
  textDim,
  bg: '#FFFFFF',
  neutral200: '#E5E7EB', // relleno de botón deshabilitado
  danger800,
  warnSoft,
  // Nombres anteriores (alias)
  primary: blue600,
  primaryDark: blue800, // botón primario presionado
  primarySoft: blue50, // chips seleccionados, fila presionada
  accent: accent700, // solo la acción "Publicar" y destacados con texto
  accentBright: accent500, // solo decorativo, no lleva texto
  danger,
  dangerSoft: '#FDECEA',
  onPrimary: '#FFFFFF',
  success: '#1B5E20',
  successSoft: '#E8F5E9',
  background: '#FFFFFF',
  surface: '#F5F7FA',
  text: '#1B1B1B',
  muted: textDim,
  border: '#D1D5DB',
  error: danger, // = danger
  warning: '#B26A00',
  splash: '#F2F2F0', // fondo del ícono y de la pantalla de carga
  // Estados: siempre con texto (fg sobre bg), nunca solo color.
  status: {
    publication: {
      open: { fg: blue600, bg: blue50 },
      in_claim: { fg: accent800, bg: warnSoft },
      resolved: { fg: '#1B5E20', bg: '#E8F5E9' },
      expired: { fg: '#4B5563', bg: '#F5F7FA' },
      pending: { fg: accent800, bg: warnSoft }, // «Pendiente de envío» (aún sin dato)
    },
    claim: {
      pending: { fg: blue600, bg: blue50 },
      accepted: { fg: '#1B5E20', bg: '#E8F5E9' },
      rejected: { fg: danger800, bg: '#FDECEA' },
      expired: { fg: '#4B5563', bg: '#F5F7FA' },
    },
  },
};

// Base 4. Las claves nuevas son nombres de uso.
export const spacing = {
  xs: 4,
  sm: 8,
  ms: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  screen: 16, // margen lateral de pantalla
  card: 16, // padding de tarjeta
  cardTight: 12, // tarjetas estrechas
  formGap: 24, // entre bloques de formulario
  sectionGap: 32, // entre secciones
};

// El radio significa algo: etiqueta 6, botón/campo/miniatura 8, tarjeta 12, chip 18, avatar 999.
export const radius = {
  tag: 6,
  button: 8,
  field: 8,
  thumb: 8,
  card: 12,
  chip: 18,
  avatar: 999,
  // Nombres anteriores
  sm: 6,
  md: 8,
  lg: 12,
  pill: 999,
};

// Pesos 400 y 500 únicamente.
const titleBar = { fontSize: 20, lineHeight: 28, fontWeight: '500', letterSpacing: 0.15 };
const bodyStrong = { fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.15 };
const meta = { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0.25 };

export const typography = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: '500', letterSpacing: 0 },
  titleBar,
  section: { fontSize: 18, lineHeight: 24, fontWeight: '500', letterSpacing: 0 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0.15 },
  bodyStrong,
  button: { fontSize: 16, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
  meta,
  // Nombres anteriores (alias)
  title: titleBar,
  subtitle: bodyStrong,
  small: meta,
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.25 },
};

// Elevación: 0 tarjetas (se separan con borde), 2 encabezado azul, 8 barra de pestañas y de acción.
const none = {
  elevation: 0,
  shadowColor: '#000000',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
};

export const shadow = {
  none,
  header: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  bar: {
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  card: none, // alias: las tarjetas no llevan sombra
};

export const touch = { min: 48 };
