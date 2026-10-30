import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { colors, radius, spacing, typography } from '../constants/theme';
import { addDays, formatApiDate } from '../utils/dates';

// value y maxDate van como 'YYYY-MM-DD': con ese formato, comparar los strings alcanza para saber cuál es antes.
export default function DateStepper({ value, onChange, maxDate }) {
  const canGoForward = value < maxDate;
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(addDays(value, -1))}
        style={styles.arrow}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Día anterior"
      >
        <Icon name="back" size={24} color={colors.blue600} />
      </Pressable>
      <Text style={styles.date}>{formatApiDate(value)}</Text>
      <Pressable
        onPress={() => onChange(addDays(value, 1))}
        disabled={!canGoForward}
        style={styles.arrow}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Día siguiente"
        accessibilityState={{ disabled: !canGoForward }}
      >
        <Icon name="chevron" size={24} color={canGoForward ? colors.blue600 : colors.textDim} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.field,
    marginBottom: spacing.md,
  },
  arrow: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  date: { ...typography.bodyStrong, color: colors.text },
});
