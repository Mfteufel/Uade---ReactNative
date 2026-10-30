import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, touch, typography } from '../constants/theme';
import Icon from './Icon';

// variant: 'primary' (relleno) | 'secondary' (borde) | 'accent' (solo Publicar) | 'danger' | 'dangerOutline' | 'link' (solo texto).
//   Una variante desconocida cae en 'primary'.
// title: etiqueta. `label` es un alias (si vienen los dos, manda `title`).
// loading: reemplaza la etiqueta por un spinner + `loadingTitle` (gerundio; por defecto, la etiqueta) sin cambiar el ancho.
// disabled: relleno neutral200 (o borde `border`) con texto textDim; no depende de la opacidad.
// dimmed: se ve como deshabilitado pero `onPress` sigue funcionando (por ejemplo, para mostrar un aviso).
// disabledReason: motivo en 14 sp debajo del botón (útil al deshabilitar un primario).
// icon: nombre de un ícono de Icon.js; siempre va junto a la etiqueta (nunca botón de solo ícono).
// style: estilo opcional del contenedor (por ejemplo { flex: 1 } en barras de acción).
// accessibilityLabel: por defecto, la etiqueta.
const VARIANTS = {
  primary: {
    normal: { bg: colors.blue600, fg: colors.onPrimary },
    pressed: { bg: colors.blue800, fg: colors.onPrimary },
    off: { bg: colors.neutral200, fg: colors.textDim },
  },
  secondary: {
    normal: { bg: 'transparent', fg: colors.blue600, border: colors.blue600 },
    pressed: { bg: colors.blue50, fg: colors.blue800, border: colors.blue800 },
    off: { bg: 'transparent', fg: colors.textDim, border: colors.border },
  },
  accent: {
    normal: { bg: colors.accent700, fg: colors.onPrimary },
    pressed: { bg: colors.accent800, fg: colors.onPrimary },
    off: { bg: colors.neutral200, fg: colors.textDim },
  },
  danger: {
    normal: { bg: colors.danger, fg: colors.onPrimary },
    pressed: { bg: colors.danger800, fg: colors.onPrimary },
    off: { bg: colors.neutral200, fg: colors.textDim },
  },
  dangerOutline: {
    normal: { bg: 'transparent', fg: colors.danger, border: colors.danger },
    pressed: { bg: colors.dangerSoft, fg: colors.danger800, border: colors.danger800 },
    off: { bg: 'transparent', fg: colors.textDim, border: colors.border },
  },
  link: {
    normal: { bg: 'transparent', fg: colors.blue600 },
    pressed: { bg: colors.blue50, fg: colors.blue800 },
    off: { bg: 'transparent', fg: colors.textDim },
  },
};

export default function Button({
  title,
  label,
  onPress,
  loading = false,
  loadingTitle,
  disabled = false,
  dimmed = false,
  disabledReason,
  variant = 'primary',
  icon,
  style,
  accessibilityLabel,
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const isLink = variant === 'link';
  const text = title !== undefined ? title : label;
  const inactive = disabled || loading; // no responde al toque
  const looksOff = (disabled || dimmed) && !loading; // aspecto deshabilitado (cargando conserva el color normal)

  const button = (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || text}
      accessibilityHint={dimmed ? 'Esta acción no está disponible por ahora.' : undefined}
      accessibilityState={{ disabled: disabled || dimmed || loading, busy: loading }}
      hitSlop={isLink ? 8 : undefined}
      android_ripple={looksOff ? undefined : { color: v.normal.fg + '33' }}
      style={({ pressed }) => {
        const s = looksOff ? v.off : pressed && !inactive ? v.pressed : v.normal;
        return [
          styles.base,
          isLink ? styles.link : styles.inline,
          { backgroundColor: s.bg },
          s.border && styles.bordered,
          s.border && { borderColor: s.border },
          !disabledReason && style,
        ];
      }}
    >
      {({ pressed }) => {
        const s = looksOff ? v.off : pressed && !inactive ? v.pressed : v.normal;
        const labelEl = <Text style={[styles.text, { color: s.fg }]}>{text}</Text>;
        if (loading) {
          // La etiqueta original queda invisible para conservar el ancho; el spinner y el gerundio se superponen.
          return (
            <View style={styles.row}>
              <Text style={[styles.text, styles.hidden]} importantForAccessibility="no">
                {text}
              </Text>
              <View style={styles.overlay}>
                <ActivityIndicator color={s.fg} size="small" />
                <Text style={[styles.text, styles.loadingText, { color: s.fg }]} numberOfLines={1}>
                  {loadingTitle || text}
                </Text>
              </View>
            </View>
          );
        }
        return (
          <View style={styles.row}>
            {icon ? <Icon name={icon} size={20} color={s.fg} style={styles.icon} /> : null}
            {labelEl}
          </View>
        );
      }}
    </Pressable>
  );

  if (!disabledReason) return button;
  return (
    <View style={style}>
      {button}
      <Text style={styles.reason}>{disabledReason}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.min,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: { paddingHorizontal: 20, minWidth: 96 },
  link: { paddingHorizontal: spacing.sm },
  bordered: { borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginRight: spacing.sm },
  hidden: { opacity: 0 },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { marginLeft: spacing.sm },
  text: { textAlign: 'center', fontSize: typography.button.fontSize, lineHeight: typography.button.lineHeight, fontWeight: typography.button.fontWeight, letterSpacing: typography.button.letterSpacing },
  reason: { marginTop: spacing.xs, fontSize: typography.meta.fontSize, lineHeight: typography.meta.lineHeight, color: colors.textDim },
});
