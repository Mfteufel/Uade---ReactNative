import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import Icon from './Icon';

// Fila de 56 dp: ícono de 24 en textDim, título, subtítulo opcional, contador y chevron de 20.
// danger (variante destructiva): ícono y texto en danger, sin chevron.
// count: contador opcional en meta. dot: punto de novedad (siempre con texto en el destino).
// last: la última fila de un grupo no lleva divisor. El divisor va sangrado 56 dp.
export default function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  danger = false,
  accessibilityLabel,
  count,
  dot = false,
  last = false,
}) {
  const tint = danger ? colors.danger : colors.textDim;
  const hasCount = count !== undefined && count !== null && count !== '';
  const baseLabel = subtitle ? `${title}, ${subtitle}` : title;
  const label = accessibilityLabel || (hasCount ? `${baseLabel}, ${count}` : baseLabel);
  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {icon ? (
          <View style={styles.iconBox}>
            <Icon name={icon} size={24} color={tint} />
            {dot ? <View style={styles.dot} /> : null}
          </View>
        ) : null}
        <View style={styles.texts}>
          <Text style={[styles.title, danger && styles.danger]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {hasCount ? <Text style={styles.count}>{count}</Text> : null}
        {danger ? null : <Icon name="chevron" size={20} color={colors.textDim} />}
      </Pressable>
      {last ? null : <View style={styles.divider} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: colors.bg },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
  },
  pressed: { backgroundColor: colors.blue50 },
  iconBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: radius.avatar,
    backgroundColor: colors.accent500,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  texts: { flex: 1 },
  title: { ...typography.body, color: colors.text },
  danger: { color: colors.danger },
  subtitle: { ...typography.meta, color: colors.textDim },
  count: { ...typography.meta, color: colors.textDim },
  // Sangría de 56 dp: 16 de padding + 24 de ícono + 16 de gap.
  divider: { height: 1, marginLeft: 56, backgroundColor: colors.border },
});
