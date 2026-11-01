import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';

// Aviso en pantalla. Sin botón de cerrar: desaparece cuando desaparece la condición.
// kind: 'info' (blue50, barra blue600) | 'warn' (warnSoft, barra accent500) | 'offline' (surface, barra border,
//   a todo el ancho y sin radio, para ir pegado debajo del encabezado). Un valor desconocido cae en 'info'.
// message: texto del aviso (16 sp).
// style: estilo opcional del contenedor.
const KINDS = {
  info: { bg: colors.blue50, bar: colors.blue600 },
  warn: { bg: colors.warnSoft, bar: colors.accent500 },
  offline: { bg: colors.surface, bar: colors.border },
};

export default function Banner({ kind = 'info', message = '', style }) {
  const k = KINDS[kind] || KINDS.info;
  const full = kind === 'offline';
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={message}
      style={[styles.box, { backgroundColor: k.bg }, full ? styles.full : styles.rounded, style]}
    >
      <View style={[styles.bar, { backgroundColor: k.bar }]} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'stretch', padding: spacing.ms, overflow: 'hidden' },
  rounded: { borderRadius: radius.button },
  full: { alignSelf: 'stretch', borderRadius: 0 },
  bar: { width: 4, borderRadius: 2, marginRight: spacing.ms },
  text: { flex: 1, ...typography.body, color: colors.text },
});
