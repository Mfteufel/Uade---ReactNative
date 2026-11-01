import { StyleSheet, Text, View } from 'react-native';
import Chip from './Chip';
import Icon from './Icon';
import { colors, spacing, typography } from '../constants/theme';

// Elegir una opción de una lista corta, con Chip. options: [{ id, name }]
// label: etiqueta del grupo (14 sp). error: mensaje debajo, con ícono y texto de 16 sp.
export default function OptionChips({ label, options, selectedId, onSelect, error }) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {options.map((option) => (
          <Chip
            key={option.id}
            label={option.name}
            selected={option.id === selectedId}
            onPress={() => onSelect(option.id)}
          />
        ))}
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <Icon name="warning" size={20} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { ...typography.caption, marginBottom: spacing.sm, color: colors.textDim },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  error: { ...typography.body, flex: 1, color: colors.danger },
});
