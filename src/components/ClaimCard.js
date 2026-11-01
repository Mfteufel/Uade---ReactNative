import { StyleSheet, Text, View } from 'react-native';
import Card from './Card';
import ClaimStatusBadge from './ClaimStatusBadge';
import Icon from './Icon';
import { CLAIM_ROLE_LABEL, CLAIM_STATUS, CLAIM_TYPE_LABEL } from '../constants/claims';
import { colors, radius, spacing, typography } from '../constants/theme';
import { formatDateTime } from '../utils/formatDateTime';

const HOUR_MS = 60 * 60 * 1000;

// Tiempo que queda de las 48 h para responder, escrito en horas (redondeo hacia arriba).
// Devuelve null si el plazo ya pasó (el estado «Vencido» lo dice la etiqueta).
export function formatTimeLeft(expiresAt, now = Date.now()) {
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const hours = Math.ceil(ms / HOUR_MS);
  return hours < 1 ? 'menos de 1 h' : `${hours} h`;
}

// Una fila de "Mis reclamos": publicación, tipo, rol del usuario, la otra persona, fecha y estado.
// Si está pendiente, escribe el tiempo restante («Quedan 31 h para que responda» / «Te quedan 11 h para responder»).
export default function ClaimCard({ claim, onPress }) {
  const isSent = claim.role === 'claimer';
  const left = claim.status === 'pending' ? formatTimeLeft(claim.expiresAt) : null;
  const timeText = left ? (isSent ? `Quedan ${left} para que responda` : `Te quedan ${left} para responder`) : null;
  const typeRole = `${CLAIM_TYPE_LABEL[claim.type]} · ${CLAIM_ROLE_LABEL[claim.role]}`;
  const other = `${isSent ? 'Publicó' : 'Reclama'}: ${claim.otherParty.name}`;
  const statusLabel = (CLAIM_STATUS[claim.status] ?? { label: claim.status }).label;
  const label = [claim.publication.title, typeRole, other, formatDateTime(claim.createdAt), statusLabel, timeText]
    .filter(Boolean)
    .join('. ');

  return (
    <Card onPress={onPress} accessibilityLabel={label} tight style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Icon name={claim.type === 'found' ? 'pin' : 'tag'} size={24} color={colors.textDim} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>{claim.publication.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>{typeRole}</Text>
          <Text style={styles.meta} numberOfLines={2}>{other}</Text>
          <Text style={styles.meta}>{formatDateTime(claim.createdAt)}</Text>
          <View style={styles.tag}>
            <ClaimStatusBadge status={claim.status} />
          </View>
        </View>
      </View>
      {timeText ? (
        <View style={styles.timeRow}>
          <Icon name="clock" size={20} color={colors.accent800} />
          <Text style={styles.timeText}>{timeText}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.ms },
  row: { flexDirection: 'row' },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.thumb,
    backgroundColor: colors.neutral200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginLeft: spacing.ms },
  title: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.meta, color: colors.textDim },
  tag: { marginTop: spacing.xs, alignSelf: 'flex-start' },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.ms,
    paddingTop: spacing.ms,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  timeText: { ...typography.body, color: colors.accent800, marginLeft: spacing.sm, flex: 1 },
});
