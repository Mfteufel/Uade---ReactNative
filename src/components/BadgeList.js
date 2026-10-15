import { StyleSheet, Text, View } from 'react-native';
import { getEarnedBadges } from '../constants/badges';
import { colors, spacing } from '../constants/theme';

// Muestra solo las insignias que el usuario ya ganó.
export default function BadgeList({ reputation }) {
  const badges = getEarnedBadges(reputation);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Insignias</Text>
      {badges.length === 0 ? (
        <Text style={styles.empty}>Todavía no ganó insignias.</Text>
      ) : (
        badges.map((badge) => (
          <View key={badge.id} style={styles.badge}>
            <Text style={styles.icon}>{badge.icon}</Text>
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
  title: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', marginBottom: spacing.sm },
  empty: { color: colors.muted },
  badge: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  icon: { fontSize: 28, marginRight: spacing.md },
  badgeText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  description: { fontSize: 13, color: colors.muted },
});
