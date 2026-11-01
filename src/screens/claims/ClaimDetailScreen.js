import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../../components/Avatar';
import Banner from '../../components/Banner';
import BottomActionBar from '../../components/BottomActionBar';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ClaimStatusBadge from '../../components/ClaimStatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import Field from '../../components/Field';
import Icon from '../../components/Icon';
import { useNetwork } from '../../context/NetworkContext';
import useClaimDetail from '../../hooks/useClaimDetail';
import { showOfflineToast } from '../../utils/offlineToast';
import { claimPhotoSource } from '../../services/claimsApi';
import { CLAIM_ROLE_LABEL, CLAIM_TYPE_LABEL } from '../../constants/claims';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatDateTime } from '../../utils/formatDateTime';

// Textos de las dos confirmaciones (las preguntas son las de siempre; el botón repite el verbo exacto).
// Aceptar o rechazar no se puede deshacer, por eso el cuerpo lo dice.
const CONFIRMS = {
  accept: {
    title: 'Aceptar reclamo',
    message: '¿Confirmás que este reclamo corresponde a tu publicación?',
    confirmLabel: 'Aceptar reclamo',
  },
  reject: {
    title: 'Rechazar reclamo',
    message: '¿Seguro que querés rechazar este reclamo?',
    confirmLabel: 'Rechazar reclamo',
  },
};

export default function ClaimDetailScreen({ route, navigation }) {
  const { claimId } = route.params;
  const { claim, loading, error, load, deciding, actionError, onAccept, onReject } = useClaimDetail(claimId);
  const { isOnline } = useNetwork();
  // Diálogo abierto: null | 'accept' | 'reject'.
  const [confirm, setConfirm] = useState(null);
  // Sin conexión, los botones se ven grises y al tocarlos solo avisan.
  const whenOnline = (action) => () => (isOnline ? action() : showOfflineToast());

  if (loading && !claim) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.blue600} accessibilityLabel="Cargando reclamo" />
      </View>
    );
  }

  if (!claim) {
    return (
      <View style={[styles.screen, styles.center, styles.errorBox]}>
        <Banner kind="warn" message={error} />
        <Button variant="link" title="Reintentar" onPress={load} />
      </View>
    );
  }

  const isPublisher = claim.role === 'publisher';
  const other = claim.otherParty;
  const showDecision = isPublisher && claim.status === 'pending';
  const dialog = confirm ? CONFIRMS[confirm] : null;

  // Cierra el diálogo y recién después decide; el hook evita la doble pulsación.
  const confirmDecision = () => {
    const action = confirm === 'accept' ? onAccept : onReject;
    setConfirm(null);
    action();
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {error ? <Banner kind="warn" message={error} style={styles.gap} /> : null}
        {actionError ? <Banner kind="warn" message={actionError} style={styles.gap} /> : null}

        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">{claim.publication.title}</Text>
          <ClaimStatusBadge status={claim.status} />
        </View>

        <Field label="Tipo de reclamo" value={`${CLAIM_TYPE_LABEL[claim.type]} · ${CLAIM_ROLE_LABEL[claim.role]}`} />
        <Field label="Enviado" value={formatDateTime(claim.createdAt)} />
        {claim.status === 'expired' ? <Field label="Venció" value={formatDateTime(claim.expiresAt)} /> : null}
        {claim.decidedAt && claim.status !== 'expired' ? <Field label="Resuelto" value={formatDateTime(claim.decidedAt)} /> : null}
        {claim.role === 'claimer' ? <Field label="Intento" value={`${claim.attemptNumber} de ${claim.maxAttempts}`} /> : null}

        {/* La otra parte, en una tarjeta tocable que lleva a su perfil público. */}
        <Card
          style={styles.person}
          onPress={() => navigation.navigate('PublicProfile', { userId: other.id })}
          accessibilityLabel={`${isPublisher ? 'Quien reclama' : 'Quien publicó'}: ${other.name}. Ver perfil`}
        >
          <Avatar uri={other.photoUri} name={other.name} size={48} />
          <View style={styles.personText}>
            <Text style={styles.label}>{isPublisher ? 'Quien reclama' : 'Quien publicó'}</Text>
            <Text style={styles.personName}>{other.name}</Text>
            {other.phone ? <Text style={styles.phone}>Teléfono: {other.phone}</Text> : null}
          </View>
          <Icon name="chevron" size={24} color={colors.textDim} />
        </Card>

        {claim.foundNeighborhood ? <Field label="Barrio donde lo encontró" value={claim.foundNeighborhood.name} /> : null}
        {claim.description ? <Field label="Descripción" value={claim.description} /> : null}
        {/* La foto del reclamo es privada: el servidor la entrega solo con el token de una de las dos partes. */}
        {claim.photoUri ? (
          <Image
            source={claimPhotoSource(claim.photoUri)}
            style={styles.photo}
            accessibilityLabel="Foto adjunta al reclamo"
          />
        ) : null}

        {/* Solo el publicador recibe la respuesta del solicitante y si coincide; la respuesta correcta no sale del servidor. */}
        {isPublisher && claim.type === 'mine' ? (
          <View style={styles.verification}>
            <Text style={styles.label}>Respuesta de verificación</Text>
            <Text style={styles.answer}>{claim.verificationAnswer}</Text>
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
      </ScrollView>

      {/* Barra fija: la coordinación del encuentro solo existe con el reclamo aceptado (el servidor lo vuelve a validar);
          la decisión es solo del publicador con el reclamo pendiente. En los demás casos no hay barra. */}
      {claim.status === 'accepted' ? (
        <BottomActionBar>
          <Button
            title="Coordinar el encuentro"
            dimmed={!isOnline}
            onPress={whenOnline(() => navigation.navigate('MeetingPoint', { claimId: claim.id }))}
          />
        </BottomActionBar>
      ) : null}

      {showDecision ? (
        <BottomActionBar>
          <Button
            variant="danger"
            title="Rechazar"
            accessibilityLabel="Rechazar reclamo"
            disabled={deciding}
            dimmed={!isOnline}
            onPress={whenOnline(() => setConfirm('reject'))}
          />
          <Button
            title="Aceptar"
            accessibilityLabel="Aceptar reclamo"
            loading={deciding}
            dimmed={!isOnline}
            onPress={whenOnline(() => setConfirm('accept'))}
          />
        </BottomActionBar>
      ) : null}

      <ConfirmDialog
        visible={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        danger={confirm === 'reject'}
        onConfirm={confirmDecision}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1 },
  container: { padding: spacing.screen, flexGrow: 1 },
  gap: { marginBottom: spacing.md },
  header: { marginBottom: spacing.md },
  title: { ...typography.section, color: colors.text, marginBottom: spacing.sm },
  person: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  personText: { flex: 1, marginHorizontal: spacing.md },
  label: { ...typography.caption, color: colors.textDim },
  personName: { ...typography.bodyStrong, color: colors.text },
  phone: { ...typography.body, color: colors.text, marginTop: 2 },
  photo: { width: '100%', height: 240, borderRadius: radius.card, backgroundColor: colors.surface, marginTop: spacing.md },
  // Respuesta del solicitante destacada con barra azul de 4 dp.
  verification: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderLeftWidth: 4,
    borderLeftColor: colors.blue600,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  answer: { ...typography.bodyStrong, color: colors.text, marginTop: 2 },
  match: { ...typography.body, color: colors.success, marginTop: spacing.xs },
  noMatch: { ...typography.body, color: colors.error, marginTop: spacing.xs },
  note: { ...typography.body, color: colors.textDim, marginTop: spacing.md },
  errorBox: { alignItems: 'stretch', justifyContent: 'center', padding: spacing.screen },
});
