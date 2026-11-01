import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';

// Progreso de un asistente: barras de 4 dp + «Paso N de M» + nombre del paso.
// current: número de paso actual (desde 1). total: cantidad de pasos. name: nombre del paso.
export default function StepProgress({ current = 1, total = 1, name = '' }) {
  const count = Math.max(1, Math.floor(total));
  const step = Math.min(Math.max(1, Math.floor(current)), count);
  const bars = Array.from({ length: count }, (_, i) => i + 1);
  return (
    <View
      accessible
      accessibilityLabel={`Paso ${step} de ${count}${name ? `. ${name}` : ''}`}
    >
      <View style={styles.bars} importantForAccessibility="no-hide-descendants">
        {bars.map((n) => (
          <View key={n} style={[styles.bar, n <= step ? styles.on : styles.off]} />
        ))}
      </View>
      <Text style={styles.step}>{`Paso ${step} de ${count}`}</Text>
      {name ? <Text style={styles.name}>{name}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row' },
  bar: { flex: 1, height: 4, borderRadius: 2, marginRight: spacing.xs },
  on: { backgroundColor: colors.accent500 },
  off: { backgroundColor: colors.neutral200 },
  step: { ...typography.meta, color: colors.textDim, marginTop: spacing.sm },
  name: { ...typography.bodyStrong, color: colors.text },
});
