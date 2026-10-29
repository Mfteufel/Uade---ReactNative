import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../constants/theme';

// Opción seleccionable (situación, categoría, radio, período).
export default function Chip({ label, selected = false, onPress, disabled = false }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.chip, selected && styles.selected, disabled && styles.disabled]}>
      <Text style={[styles.text, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  disabled: { opacity: 0.5 },
  text: { color: colors.text, fontWeight: '500' },
  selectedText: { color: '#fff' },
});
