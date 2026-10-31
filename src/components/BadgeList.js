import { StyleSheet, Text, View } from 'react-native';
import { getEarnedBadges } from '../constants/badges';
import { colors, spacing, typography } from '../constants/theme';

// Muestra solo las insignias que el usuario ya ganó.
// El ícono va dentro de un círculo con borde accent500 (el naranja decorativo nunca lleva texto encima).
export default function BadgeList({ reputation }) {
  const badges = getEarnedBadges(reputation);
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Insignias</Text>
      {badges.length === 0 ? (
        <Text style={styles.empty}>Todavía no ganó insignias.</Text>
      ) : (
        badges.map((badge) => (
          <View key={badge.id} style={styles.badge}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>{badge.icon}</Text>
            </View>
            <View style={styles.badgeText}>
              <Text style={styles.name}>{badge.name}</Text>
              <Text style={styles.description}>{badge.description}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.lg },
  title: { ...typography.meta, color: colors.textDim, marginBottom: spacing.sm },
  empty: { ...typography.body, color: colors.textDim },
  badge: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.accent500,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  icon: { fontSize: 24 },
  badgeText: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.text },
  description: { ...typography.meta, color: colors.textDim },
});
