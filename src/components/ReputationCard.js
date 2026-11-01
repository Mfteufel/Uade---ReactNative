import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';

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
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.md, marginTop: spacing.md },
  title: { ...typography.meta, color: colors.textDim },
  points: { ...typography.display, color: colors.blue600, marginVertical: spacing.xs },
  row: { flexDirection: 'row', marginTop: spacing.sm },
  stat: { flex: 1 },
  statValue: { ...typography.bodyStrong, color: colors.text },
  statLabel: { ...typography.meta, color: colors.textDim },
});
