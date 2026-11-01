import { Pressable, StyleSheet, Text, View } from 'react-native';
import Input from './Input';
import { colors, spacing, typography } from '../constants/theme';

// Elegir un barrio de la lista: se escribe para filtrar y se toca una sugerencia.
// selected: { id, name } o null. suggestions: barrios que coinciden con la búsqueda.
export default function NeighborhoodPicker({ label, selected, search, onSearchChange, suggestions, onSelect, error }) {
  return (
    <View>
      {selected ? (
        <View style={styles.selected}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.selectedName}>{selected.name}</Text>
        </View>
      ) : null}
      <Input
        label={selected ? 'Cambiar barrio' : label}
        value={search}
        onChangeText={onSearchChange}
        placeholder="Escribí el barrio, ej: Palermo"
        error={error}
      />
      {suggestions.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onSelect(item)}
          style={styles.option}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${item.locality}`}
        >
          <Text style={styles.optionText}>{item.name}</Text>
          <Text style={styles.optionLocality}>{item.locality}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  selected: { marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textDim, marginBottom: spacing.xs },
  selectedName: { ...typography.bodyStrong, color: colors.primary },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  optionText: { ...typography.body, color: colors.text },
  optionLocality: { ...typography.meta, color: colors.textDim },
});
