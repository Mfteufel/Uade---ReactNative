import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import ClaimStatusBadge from '../../components/ClaimStatusBadge';
import Field from '../../components/Field';
import { useNetwork } from '../../context/NetworkContext';
import useClaimDetail from '../../hooks/useClaimDetail';
import { showOfflineToast } from '../../utils/offlineToast';
import { claimPhotoSource } from '../../services/claimsApi';
import { CLAIM_ROLE_LABEL, CLAIM_TYPE_LABEL } from '../../constants/claims';
import { colors, spacing } from '../../constants/theme';
import { formatDateTime } from '../../utils/formatDateTime';

// Pide confirmación antes de decidir: aceptar o rechazar no se puede deshacer.
const confirmDecision = (title, message, confirmText, onConfirm) =>
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmText, onPress: onConfirm },
  ]);

export default function ClaimDetailScreen({ route, navigation }) {
  const { claimId } = route.params;
  const { claim, loading, error, load, deciding, actionError, onAccept, onReject } = useClaimDetail(claimId);
  const { isOnline } = useNetwork();
  // Sin conexión, los botones se ven grises y al tocarlos solo avisan.
  const whenOnline = (action) => () => (isOnline ? action() : showOfflineToast());

  if (loading && !claim) return <ActivityIndicator style={styles.center} size="large" />;

  if (!claim) {
    return (
      <View style={[styles.center, styles.errorBox]}>
        <Text style={styles.errorText}>{error}</Text>
        <Button variant="link" title="Reintentar" onPress={load} />
      </View>
    );
  }

  const isPublisher = claim.role === 'publisher';
  const other = claim.otherParty;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <Text style={styles.banner}>{error}</Text> : null}
      {actionError ? <Text style={styles.banner}>{actionError}</Text> : null}

      <View style={styles.header}>
        <Text style={styles.title}>{claim.publication.title}</Text>
        <ClaimStatusBadge status={claim.status} />
      </View>

      <Field label="Tipo de reclamo" value={`${CLAIM_TYPE_LABEL[claim.type]} · ${CLAIM_ROLE_LABEL[claim.role]}`} />
      <Field label="Enviado" value={formatDateTime(claim.createdAt)} />
      {claim.status === 'expired' ? <Field label="Venció" value={formatDateTime(claim.expiresAt)} /> : null}
      {claim.decidedAt && claim.status !== 'expired' ? <Field label="Resuelto" value={formatDateTime(claim.decidedAt)} /> : null}
      {claim.role === 'claimer' ? <Field label="Intento" value={`${claim.attemptNumber} de ${claim.maxAttempts}`} /> : null}

      <View style={styles.person}>
        <Avatar uri={other.photoUri} name={other.name} size={48} />
        <View style={styles.personText}>
          <Text style={styles.personLabel}>{isPublisher ? 'Quien reclama' : 'Quien publicó'}</Text>
          <Text style={styles.personName}>{other.name}</Text>
          {other.phone ? <Text style={styles.phone}>Teléfono: {other.phone}</Text> : null}
        </View>
        <Button variant="link" title="Ver perfil" onPress={() => navigation.navigate('PublicProfile', { userId: other.id })} />
      </View>

      {claim.foundNeighborhood ? <Field label="Barrio donde lo encontró" value={claim.foundNeighborhood.name} /> : null}
      {claim.description ? <Field label="Descripción" value={claim.description} /> : null}
      {/* La foto del reclamo es privada: el servidor la entrega solo con el token de una de las dos partes. */}
      {claim.photoUri ? <Image source={claimPhotoSource(claim.photoUri)} style={styles.photo} /> : null}

      {/* Solo el publicador recibe la respuesta del solicitante y si coincide; la respuesta correcta no sale del servidor. */}
      {isPublisher && claim.type === 'mine' ? (
        <View style={styles.verification}>
          <Text style={styles.personLabel}>Respuesta de verificación</Text>
          <Text style={styles.personName}>{claim.verificationAnswer}</Text>
          <Text style={claim.answerMatches ? styles.match : styles.noMatch}>
            {claim.answerMatches ? 'Coincide con la respuesta que cargaste.' : 'No coincide con la respuesta que cargaste.'}
          </Text>
        </View>
      ) : null}

      {claim.status === 'pending' ? (
        <Text style={styles.note}>
          {/* La fecha de vencimiento proviene de la API. El teléfono solo la muestra;
              no decide cuándo un reclamo deja de estar vigente. */}
          Sin respuesta, este reclamo vence el {formatDateTime(claim.expiresAt)}.
        </Text>
      ) : null}
      {(claim.status === 'rejected' || claim.status === 'expired') && claim.role === 'claimer' ? (
        <Text style={styles.note}>
          {claim.attemptsLeft > 0
            ? `Te quedan ${claim.attemptsLeft} ${claim.attemptsLeft === 1 ? 'intento' : 'intentos'} para esta publicación.`
            : 'No te quedan intentos para esta publicación.'}
        </Text>
      ) : null}

      {/* La coordinación del encuentro solo existe con el reclamo aceptado; el servidor lo vuelve a validar. */}
      {claim.status === 'accepted' ? (
        <View style={styles.actions}>
          <Button
            title="Coordinar punto de encuentro"
            dimmed={!isOnline}
            onPress={whenOnline(() => navigation.navigate('MeetingPoint', { claimId: claim.id }))}
          />
        </View>
      ) : null}

      {isPublisher && claim.status === 'pending' ? (
        <View style={styles.actions}>
          <Button
            title="Aceptar reclamo"
            loading={deciding}
            dimmed={!isOnline}
            onPress={whenOnline(() =>
              confirmDecision('Aceptar reclamo', '¿Confirmás que este reclamo corresponde a tu publicación?', 'Aceptar', onAccept),
            )}
          />
          <Button
            variant="link"
            title="Rechazar reclamo"
            disabled={deciding}
            dimmed={!isOnline}
            onPress={whenOnline(() =>
              confirmDecision('Rechazar reclamo', '¿Seguro que querés rechazar este reclamo?', 'Rechazar', onReject),
            )}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  container: { padding: spacing.lg, backgroundColor: colors.background, flexGrow: 1 },
  header: { marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  person: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  personText: { flex: 1, marginLeft: spacing.md },
  personLabel: { fontSize: 12, color: colors.muted, textTransform: 'uppercase' },
  personName: { fontSize: 16, color: colors.text, fontWeight: '600' },
  phone: { color: colors.text, marginTop: 2 },
  photo: { width: '100%', height: 240, borderRadius: 8, backgroundColor: colors.surface, marginTop: spacing.md },
  verification: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  match: { color: colors.primary, marginTop: spacing.xs },
  noMatch: { color: colors.error, marginTop: spacing.xs },
  note: { color: colors.muted, marginTop: spacing.md },
  actions: { marginTop: spacing.lg },
  banner: { backgroundColor: '#FDECEA', color: colors.error, padding: spacing.md, borderRadius: 8, marginBottom: spacing.md },
  errorBox: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { color: colors.error, textAlign: 'center' },
});
