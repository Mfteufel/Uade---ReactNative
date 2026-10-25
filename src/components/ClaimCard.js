import { Pressable, StyleSheet, Text, View } from 'react-native';
import ClaimStatusBadge from './ClaimStatusBadge';
import { CLAIM_ROLE_LABEL, CLAIM_TYPE_LABEL } from '../constants/claims';
import { colors, spacing } from '../constants/theme';
import { formatDateTime } from '../utils/formatDateTime';

// Una fila de "Mis reclamos": publicación, tipo, rol del usuario, la otra persona, fecha y estado.
export default function ClaimCard({ claim, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{claim.publication.title}</Text>
        <ClaimStatusBadge status={claim.status} />
      </View>
      <Text style={styles.line}>
        {CLAIM_TYPE_LABEL[claim.type]} · {CLAIM_ROLE_LABEL[claim.role]}
      </Text>
      <Text style={styles.muted}>
        {claim.role === 'claimer' ? 'Publicó' : 'Reclama'}: {claim.otherParty.name}
      </Text>
      <Text style={styles.muted}>{formatDateTime(claim.createdAt)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text, marginRight: spacing.sm },
  line: { color: colors.text },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
