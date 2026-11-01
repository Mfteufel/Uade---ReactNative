import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography } from '../constants/theme';

// Etiqueta de estado (StateTag): rectángulo de 24 dp de alto, radio 6, 14 sp peso 500.
// No es píldora para que no se lea como tocable. Siempre texto (fg) sobre fondo (bg), nunca solo color.
export default function StatusBadge({ label, fg, bg }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]} accessible accessibilityLabel={`Estado: ${label}`}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 24,
    justifyContent: 'center',
    borderRadius: radius.tag,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
  },
  text: { ...typography.caption },
});
