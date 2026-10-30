import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, touch, typography } from '../constants/theme';

// variant: 'primary' (relleno) | 'secondary' (borde) | 'danger' | 'accent' (solo Publicar) | 'link' (solo texto)
// style: estilo opcional del contenedor (por ejemplo { flex: 1 } en barras de acción).
// accessibilityLabel: por defecto, el title.
// La prop `icon` del plan queda para el paso 5 (depende del componente Icon).
const VARIANTS = {
  primary: { bg: colors.primary, pressedBg: colors.primaryDark, fg: colors.onPrimary },
  secondary: { bg: colors.background, pressedBg: colors.primarySoft, fg: colors.primary, border: colors.primary },
  danger: { bg: colors.danger, pressedBg: '#B71C1C', fg: colors.onPrimary },
  accent: { bg: colors.accent, pressedBg: '#A84300', fg: colors.onPrimary },
  link: { bg: 'transparent', pressedBg: colors.primarySoft, fg: colors.primary },
};

export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  accessibilityLabel,
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const isLink = variant === 'link';
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={isLink ? 8 : undefined}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed && !inactive ? v.pressedBg : v.bg },
        v.border && styles.bordered,
        v.border && { borderColor: v.border },
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.text, { color: v.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.min,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  bordered: { borderWidth: 1.5 },
  inactive: { opacity: 0.5 },
  text: { fontSize: typography.subtitle.fontSize, fontWeight: typography.subtitle.fontWeight },
});
