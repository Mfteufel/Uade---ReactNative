import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';
import { addDays, formatApiDate } from '../utils/dates';

// value y maxDate van como 'YYYY-MM-DD': con ese formato, comparar los strings alcanza para saber cuál es antes.
export default function DateStepper({ value, onChange, maxDate }) {
  const canGoForward = value < maxDate;
  return (
    <View style={styles.row}>
      <Pressable onPress={() => onChange(addDays(value, -1))} style={styles.arrow} hitSlop={8}>
        <Text style={styles.arrowText}>◀</Text>
      </Pressable>
      <Text style={styles.date}>{formatApiDate(value)}</Text>
      <Pressable
        onPress={() => onChange(addDays(value, 1))}
        disabled={!canGoForward}
        style={[styles.arrow, !canGoForward && styles.disabled]}
        hitSlop={8}
      >
        <Text style={styles.arrowText}>▶</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  arrow: { paddingVertical: 12, paddingHorizontal: spacing.lg },
  arrowText: { fontSize: 18, color: colors.primary },
  disabled: { opacity: 0.3 },
  date: { fontSize: 16, fontWeight: '600', color: colors.text },
});
