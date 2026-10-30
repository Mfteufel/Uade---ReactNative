import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';
import Icon from './Icon';

// Fila de 56 dp: ícono, título, subtítulo opcional y chevron. danger pinta ícono y título en rojo.
export default function ListRow({ icon, title, subtitle, onPress, danger = false, accessibilityLabel }) {
  const tint = danger ? colors.danger : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (subtitle ? `${title}, ${subtitle}` : title)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {icon ? (
        <View style={styles.iconBox}>
          <Icon name={icon} color={tint} />
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
      <Icon name="chevron" size={28} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.primarySoft },
  iconBox: { width: 32, alignItems: 'center', marginRight: spacing.md },
  texts: { flex: 1 },
  title: { ...typography.body, color: colors.text },
  danger: { color: colors.danger },
  subtitle: { ...typography.small, color: colors.muted },
});
