import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';

// Dato de solo lectura: etiqueta arriba (14 sp peso 500, textDim) y valor abajo (body).
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
  label: { ...typography.caption, color: colors.textDim },
  value: { ...typography.body, color: colors.text, marginTop: 2 },
});
