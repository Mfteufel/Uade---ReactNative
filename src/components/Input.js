import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import Icon from './Icon';

// Campo de texto con etiqueta siempre visible (14 sp peso 500, nunca el placeholder como etiqueta).
// minHeight 48, radio 8, borde 1 dp; con foco, borde 2 dp blue600; con error, borde 2 dp danger,
// ícono y texto de 16 sp. La validación sigue en los hooks (al enviar): acá solo se muestra el error.
// Encadena los onFocus/onBlur recibidos por props.
export default function Input({ label, error, style, onFocus, onBlur, accessibilityLabel, ...props }) {
  const [focused, setFocused] = useState(false);
  const base = accessibilityLabel || label;
  const a11yLabel = error ? (base ? `${base}. ${error}` : error) : base;
  const borderWidth = error || focused ? 2 : 1;
  const borderColor = error ? colors.danger : focused ? colors.blue600 : colors.border;
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textDim}
        accessibilityLabel={a11yLabel}
        style={[
          styles.input,
          // El borde más grueso se compensa en el padding para que el texto no se corra.
          { borderWidth, borderColor, paddingHorizontal: spacing.md - (borderWidth - 1) },
          style,
        ]}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          if (onFocus) onFocus(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          if (onBlur) onBlur(e);
        }}
      />
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
  wrapper: { marginBottom: spacing.formGap },
  label: { ...typography.caption, marginBottom: spacing.xs, color: colors.textDim },
  input: {
    minHeight: 48,
    borderRadius: radius.field,
    paddingVertical: spacing.ms,
    fontSize: typography.body.fontSize,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  error: { ...typography.body, flex: 1, color: colors.danger },
});
