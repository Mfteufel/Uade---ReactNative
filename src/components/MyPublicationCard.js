import { Image, StyleSheet, Text, View } from 'react-native';
import Button from './Button';
import { PUBLICATION_STATUS } from '../constants/publications';
import { colors, spacing } from '../constants/theme';
import { daysUntil, formatApiDate, formatShortDate } from '../utils/dates';
import { showOfflineToast } from '../utils/offlineToast';

const RENEW_WARNING_DAYS = 7;

// Tarjeta de "Mis publicaciones". Se puede renovar si venció o si le quedan pocos días.
// Las pendientes de envío todavía no vencen; si el servidor las rechazó, se pueden descartar.
export default function MyPublicationCard({ publication, onRenew, renewing, onDiscard, offline }) {
  const status = PUBLICATION_STATUS[publication.status] || { label: publication.status, color: colors.muted };
  const isPending = publication.status === 'pending';
  const daysLeft = daysUntil(publication.expiresAt);
  const isActive = publication.status === 'open' || publication.status === 'in_claim';
  const canRenew = publication.status === 'expired' || (isActive && daysLeft <= RENEW_WARNING_DAYS);
  const photo = publication.photoUrls?.[0];

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : <View style={[styles.photo, styles.noPhoto]} />}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{publication.title}</Text>
          <Text style={styles.meta}>
            {publication.type === 'lost' ? 'Perdido' : 'Encontrado'} · {publication.category.name} · {publication.neighborhood.name}
          </Text>
          <Text style={styles.meta}>Pasó el {formatApiDate(publication.occurredOn)}</Text>
          <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
          {isActive ? (
            <Text style={styles.meta}>Vence el {formatShortDate(publication.expiresAt)}</Text>
          ) : null}
        </View>
      </View>
      {isPending && !publication.error ? (
        <Text style={styles.meta}>Se va a enviar sola cuando haya conexión.</Text>
      ) : null}
      {isPending && publication.error ? (
        <>
          <Text style={styles.error}>No se pudo publicar: {publication.error}</Text>
          <Button variant="link" title="Descartar" onPress={() => onDiscard(publication.id)} />
        </>
      ) : null}
      {canRenew ? (
        <Button
          variant="link"
          title="Renovar 30 días"
          onPress={() => (offline ? showOfflineToast() : onRenew(publication.id))}
          loading={renewing}
          dimmed={offline}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  photo: { width: 72, height: 72, borderRadius: 8 },
  noPhoto: { backgroundColor: colors.border },
  info: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { color: colors.muted, marginTop: 2 },
  status: { fontWeight: '700', marginTop: spacing.xs },
  error: { color: colors.error, marginTop: spacing.xs },
});
