import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Button from './Button';
import Card from './Card';
import Icon from './Icon';
import StateTag from './StateTag';
import { PUBLICATION_STATUS } from '../constants/publications';
import { colors, radius, spacing, typography } from '../constants/theme';
import { daysUntil, formatApiDate, formatShortDate } from '../utils/dates';
import { showOfflineToast } from '../utils/offlineToast';

const RENEW_WARNING_DAYS = 7;

// Tarjeta de "Mis publicaciones". Se puede renovar si venció o si le quedan pocos días.
// Las pendientes de envío todavía no vencen; si el servidor las rechazó, se pueden descartar.
// Al tocarla se abre el detalle (las pendientes no, porque todavía no existen en el servidor).
// La zona tocable es la fila con la foto y el texto; los botones van debajo, fuera de ella.
export default function MyPublicationCard({ publication, onPress, onRenew, renewing, onDiscard, offline }) {
  const status = PUBLICATION_STATUS[publication.status] || { label: publication.status, color: colors.textDim, bg: colors.surface };
  const isPending = publication.status === 'pending';
  const daysLeft = daysUntil(publication.expiresAt);
  const isActive = publication.status === 'open' || publication.status === 'in_claim';
  const canRenew = publication.status === 'expired' || (isActive && daysLeft <= RENEW_WARNING_DAYS);
  const photo = publication.photoUrls?.[0];

  // Vencimiento a 30 días, escrito (las resueltas y las pendientes no lo muestran).
  let expiryText = '';
  if (isActive) expiryText = `Vence el ${formatShortDate(publication.expiresAt)}`;
  else if (publication.status === 'expired') expiryText = `Venció el ${formatShortDate(publication.expiresAt)}`;

  const typeName = publication.type === 'lost' ? 'Perdido' : 'Encontrado';
  const label = [publication.title, publication.neighborhood.name, `Estado: ${status.label}`, expiryText]
    .filter(Boolean)
    .join('. ');

  const content = (
    <>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.thumb} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.thumb, styles.noPhoto]}>
          <Icon name="image" size={32} color={colors.textDim} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{publication.title}</Text>
        <Text style={styles.meta} numberOfLines={2}>
          {typeName} · {publication.category.name} · {publication.neighborhood.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>Pasó el {formatApiDate(publication.occurredOn)}</Text>
        {expiryText ? <Text style={styles.meta} numberOfLines={1}>{expiryText}</Text> : null}
        <View style={styles.tag}>
          <StateTag label={status.label} fg={status.color} bg={status.bg} />
        </View>
      </View>
    </>
  );

  return (
    <Card tight style={styles.card}>
      {isPending ? (
        <View style={styles.row} accessible accessibilityLabel={label}>
          {content}
        </View>
      ) : (
        <Pressable
          onPress={() => onPress(publication.id)}
          accessibilityRole="button"
          accessibilityLabel={label}
          android_ripple={{ color: colors.blue50 }}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          {content}
        </Pressable>
      )}
      {isPending && !publication.error ? (
        <Text style={styles.note}>Se va a enviar sola cuando haya conexión.</Text>
      ) : null}
      {isPending && publication.error ? (
        <>
          <Text style={styles.error}>No se pudo publicar: {publication.error}</Text>
          <Button variant="link" title="Descartar" onPress={() => onDiscard(publication.id)} />
        </>
      ) : null}
      {canRenew ? (
        <View style={styles.action}>
          <Button
            variant="secondary"
            title="Renovar 30 días"
            loadingTitle="Renovando…"
            onPress={() => (offline ? showOfflineToast() : onRenew(publication.id))}
            loading={renewing}
            dimmed={offline}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.ms },
  row: { flexDirection: 'row', minHeight: 88, borderRadius: radius.card },
  pressed: { backgroundColor: colors.blue50 },
  thumb: { width: 88, height: 88, borderRadius: radius.thumb, backgroundColor: colors.neutral200 },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: spacing.ms },
  title: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.meta, color: colors.textDim },
  tag: { marginTop: spacing.xs },
  note: { ...typography.meta, color: colors.textDim, marginTop: spacing.sm },
  error: { ...typography.body, color: colors.error, marginTop: spacing.sm },
  action: { marginTop: spacing.ms },
});
