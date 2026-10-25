import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

// Dato de solo lectura: etiqueta chica arriba y valor abajo.
export default function Field({ label, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surface },
  label: { fontSize: 12, color: colors.muted, textTransform: 'uppercase' },
  value: { fontSize: 16, color: colors.text, marginTop: 2 },
});
