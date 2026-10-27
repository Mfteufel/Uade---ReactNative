import { Pressable, StyleSheet, Text, View } from 'react-native';
import Input from './Input';
import { colors, spacing } from '../constants/theme';

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
        <Pressable key={item.id} onPress={() => onSelect(item)} style={styles.option}>
          <Text style={styles.optionText}>{item.name}</Text>
          <Text style={styles.optionLocality}>{item.locality}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  selected: { marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: '500', marginBottom: spacing.xs },
  selectedName: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  optionText: { color: colors.text, fontSize: 16 },
  optionLocality: { color: colors.muted },
});
