import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ReputationCard({ reputation }) {
  const percent = reputation.positivePercent === null ? '—' : `${reputation.positivePercent}%`;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Reputación</Text>
      <Text style={styles.points}>{reputation.points} puntos</Text>
      <View style={styles.row}>
        <Stat value={reputation.completedReturns} label="Devoluciones" />
        <Stat value={percent} label="Valoraciones positivas" />
        <Stat value={reputation.positiveRatings + reputation.negativeRatings} label="Valoraciones" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  title: { fontSize: 12, color: colors.muted, textTransform: 'uppercase' },
  points: { fontSize: 28, fontWeight: '700', color: colors.primary, marginVertical: spacing.xs },
  row: { flexDirection: 'row', marginTop: spacing.sm },
  stat: { flex: 1 },
  statValue: { fontSize: 18, fontWeight: '600', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted },
});
