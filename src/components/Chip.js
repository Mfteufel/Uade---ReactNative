import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import Icon from './Icon';

// Opción seleccionable (situación, categoría, radio, período). Dibujo de 36 dp; hitSlop 6 para llegar a 48.
// Elegido: blue50, borde 1,5 blue600, texto blue600 y tilde. Deshabilitado: texto textDim, sin opacidad.
// variant="history": fondo surface con ícono de reloj.
export default function Chip({ label, selected = false, onPress, disabled = false, variant, accessibilityLabel }) {
  const history = variant === 'history';
  const textColor = disabled ? colors.textDim : selected ? colors.blue600 : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      style={[
        styles.chip,
        history && styles.history,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
    >
      {selected ? <Icon name="check" size={16} color={textColor} style={styles.leading} /> : null}
      {!selected && history ? <Icon name="clock" size={16} color={textColor} style={styles.leading} /> : null}
      <Text style={[styles.text, selected && styles.selectedText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  history: { backgroundColor: colors.surface },
  selected: { backgroundColor: colors.blue50, borderColor: colors.blue600, borderWidth: 1.5 },
  disabled: { borderColor: colors.border },
  leading: { marginRight: spacing.xs },
  text: { ...typography.body },
  selectedText: { fontWeight: '500' },
});
