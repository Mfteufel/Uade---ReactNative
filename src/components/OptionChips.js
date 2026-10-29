import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

// Elegir una opción de una lista corta. options: [{ id, name }]
export default function OptionChips({ label, options, selectedId, onSelect, error }) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option.id === selectedId;
          return (
            <Pressable
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { marginBottom: spacing.xs, color: colors.text, fontWeight: '500' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  error: { marginTop: spacing.xs, color: colors.error, fontSize: 13 },
});
