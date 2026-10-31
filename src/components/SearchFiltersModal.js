import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from './Button';
import SearchFields from './SearchFields';
import useSearchFilters from '../hooks/useSearchFilters';
import { colors, spacing, typography } from '../constants/theme';

// Refinar la búsqueda sin volver al inicio. Se monta solo mientras está abierto: cada vez arranca con los criterios actuales.
function FiltersForm({ current, onApply, onClose }) {
  const filters = useSearchFilters(current);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();

  const apply = () => {
    const problem = filters.validate();
    if (problem) return setError(problem);
    onApply({ ...filters.toFilters(), orden: current.orden });
  };

  return (
    <View style={styles.sheet}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Filtros</Text>
        <SearchFields filters={filters} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
        <Button title="Aplicar filtros" onPress={apply} />
        <Button variant="link" title="Cancelar" onPress={onClose} />
      </View>
    </View>
  );
}

export default function SearchFiltersModal({ visible, current, onApply, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible ? <FiltersForm current={current} onApply={onApply} onClose={onClose} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  heading: { ...typography.display, color: colors.text, marginBottom: spacing.lg },
  error: { ...typography.body, color: colors.danger, marginBottom: spacing.sm },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
});
