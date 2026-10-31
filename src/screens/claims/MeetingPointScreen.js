import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import Banner from '../../components/Banner';
import BottomActionBar from '../../components/BottomActionBar';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ConfirmDialog from '../../components/ConfirmDialog';
import Field from '../../components/Field';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import StatusBadge from '../../components/StatusBadge';
import { useNetwork } from '../../context/NetworkContext';
import useMeetingPoint from '../../hooks/useMeetingPoint';
import { MEETING_STATUS_LABEL } from '../../constants/claims';
import { PUBLICATION_STATUS } from '../../constants/publications';
import { colors, spacing } from '../../constants/theme';
import { formatDateTime } from '../../utils/formatDateTime';
import { openDirections } from '../../utils/openDirections';
import { showOfflineToast } from '../../utils/offlineToast';

// Aviso de seguridad del diseño. No hay botón de cancelar el encuentro: esa función no existe.
const SAFETY_NOTICE = 'Encontrate de día y en un lugar con gente. Si algo no te cierra, podés cancelar sin dar explicaciones.';

// Campos para proponer un lugar (el primero, o uno distinto al vigente). El botón que los envía va en la barra fija.
function PlaceForm({ form }) {
  return (
    <View style={styles.form}>
      <Input
        label="Dirección o lugar de encuentro"
        value={form.address}
        onChangeText={form.setAddress}
        placeholder="Ej: Av. Cabildo 2000, frente a la estación"
        error={form.fieldError}
        maxLength={200}
      />
      <Input
        label="Aclaración (opcional)"
        value={form.notes}
        onChangeText={form.setNotes}
        placeholder="Ej: nos vemos en la entrada principal"
        maxLength={280}
      />
    </View>
  );
}

// Se llega desde el detalle de un reclamo aceptado: navigation.navigate('MeetingPoint', { claimId }).
// El servidor indica qué puede hacer cada persona (canPropose / canAccept / canConfirmReturn); la pantalla solo lo muestra.
export default function MeetingPointScreen({ route }) {
  const { claimId } = route.params;
  const { isOnline } = useNetwork();
  const form = useMeetingPoint(claimId);
  const { meeting, loading, error, load, sending, actionError } = form;
  // Confirmación de la devolución (reemplaza al Alert).
  const [returnOpen, setReturnOpen] = useState(false);

  if (loading && !meeting) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.blue600} accessibilityLabel="Cargando punto de encuentro" />
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={[styles.screen, styles.center, styles.errorBox]}>
        <Banner kind="warn" message={error} />
        <Button variant="link" title="Reintentar" onPress={load} />
      </View>
    );
  }

  const point = meeting.meetingPoint;
  const whenOnline = (action) => (isOnline ? action : () => showOfflineToast());

  const onHowToGetThere = async () => {
    try {
      await openDirections(point);
    } catch (e) {
      Alert.alert('No se pudo abrir el mapa', e.message);
    }
  };

  // Aceptar un lugar es definitivo, así que se pide confirmación.
  const confirmAccept = () =>
    Alert.alert('Aceptar lugar', `¿Confirmás encontrarte en "${point.address}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: form.onAccept },
    ]);

  // Cierra el diálogo y recién después confirma; el hook evita la doble pulsación.
  const confirmReturnNow = () => {
    setReturnOpen(false);
    form.onConfirmReturn();
  };

  const proposeButton = (
    <Button
      key="propose"
      title="Proponer este lugar"
      loading={sending}
      loadingTitle="Proponiendo…"
      dimmed={!isOnline}
      onPress={whenOnline(form.onPropose)}
    />
  );
  const directionsButton = (variant) => (
    <Button key="directions" variant={variant} title="Cómo llegar" style={styles.tight} onPress={onHowToGetThere} />
  );

  // Barra fija: un solo primario por momento (máximo dos botones; el secundario va a la izquierda).
  let actions = null;
  if (!point && meeting.canPropose) {
    // Momento 1: quien tiene el objeto propone el primer lugar.
    actions = [proposeButton];
  } else if (meeting.canConfirmReturn) {
    // Momento 3 con devolución pendiente (C25): el primario es confirmar la devolución.
    actions = [
      directionsButton('secondary'),
      <Button
        key="return"
        title="Ya recibí el objeto"
        loading={sending}
        loadingTitle="Confirmando…"
        dimmed={!isOnline}
        onPress={whenOnline(() => setReturnOpen(true))}
      />,
    ];
  } else if (meeting.canAccept) {
    // Momento 2: la otra parte decide. Con el formulario abierto, el primario es enviar la sugerencia.
    actions = form.showForm
      ? [proposeButton]
      : [
          <Button
            key="suggest"
            variant="secondary"
            title="Sugerir otro"
            style={styles.tight}
            disabled={sending}
            onPress={form.openForm}
          />,
          <Button
            key="accept"
            title="Me queda bien"
            loading={sending}
            loadingTitle="Aceptando…"
            dimmed={!isOnline}
            onPress={whenOnline(confirmAccept)}
          />,
        ];
  } else if (point) {
    // Momento 3 sin devolución pendiente (o esperando respuesta): "Cómo llegar" es el primario.
    actions = [directionsButton('primary')];
  }

  const failure = error || actionError;

  return (
    <FormScreen
      title="Punto de encuentro"
      subtitle="Coordinen dónde entregar el objeto."
      footer={
        <>
          {actions ? <BottomActionBar>{actions}</BottomActionBar> : null}
          <ConfirmDialog
            visible={returnOpen}
            title="Confirmar devolución"
            message="Se registra la devolución y la publicación queda resuelta. No se puede deshacer."
            confirmLabel="Ya lo recibí"
            onConfirm={confirmReturnNow}
            onCancel={() => setReturnOpen(false)}
          />
        </>
      }
    >
      {failure ? <Banner kind="warn" message={failure} style={styles.gap} /> : null}
      <Banner kind="warn" message={SAFETY_NOTICE} style={styles.gap} />

      {point ? (
        <Card style={styles.gap}>
          <Field label="Lugar propuesto" value={point.address} />
          {point.notes ? <Field label="Aclaración" value={point.notes} /> : null}
          <Field label="Propuesto por" value={point.proposedByMe ? 'Vos' : point.proposedBy.name} />
          <Field label="Estado" value={MEETING_STATUS_LABEL[point.status]} />
          {point.respondedAt ? <Field label="Acordado" value={formatDateTime(point.respondedAt)} /> : null}
        </Card>
      ) : null}

      {/* Con la decisión en la barra, "Cómo llegar" baja a link dentro del scroll. */}
      {point && meeting.canAccept && !meeting.canConfirmReturn ? (
        <Button variant="link" title="Cómo llegar" onPress={onHowToGetThere} style={styles.link} />
      ) : null}

      {/* Mensaje de espera o aviso cuando esta persona no puede actuar ahora. */}
      {!meeting.canPropose && !meeting.canAccept && meeting.reason ? (
        <Banner kind="info" message={meeting.reason} style={styles.gap} />
      ) : null}

      {/* Formulario para sugerir otro lugar (quien decide) o para proponer el primero (quien tiene el objeto). */}
      {meeting.canAccept && form.showForm ? (
        <>
          <PlaceForm form={form} />
          <Button variant="link" title="Cancelar" disabled={sending} onPress={form.closeForm} style={styles.link} />
        </>
      ) : null}

      {/* La devolución la confirma quien recupera el objeto; el servidor dice si esta persona puede hacerlo ahora. */}
      {meeting.completedReturn ? (
        <Card style={styles.gap}>
          <StatusBadge
            label={PUBLICATION_STATUS.resolved.label}
            fg={PUBLICATION_STATUS.resolved.color}
            bg={PUBLICATION_STATUS.resolved.bg}
          />
          <Field label="Devolución confirmada" value={formatDateTime(meeting.completedReturn.createdAt)} />
        </Card>
      ) : null}
      {point?.status === 'accepted' && meeting.iHaveTheObject && !meeting.completedReturn ? (
        <Banner
          kind="info"
          message={`Cuando ${meeting.otherParty.name} reciba el objeto, va a confirmar la devolución desde esta pantalla.`}
          style={styles.gap}
        />
      ) : null}

      {/* Sin punto vigente, quien tiene el objeto propone el primer lugar. */}
      {!point && meeting.canPropose ? (
        <>
          <Banner
            kind="info"
            message={`Vos tenés el objeto: proponé un lugar para entregarlo. ${meeting.otherParty.name} podrá aceptarlo o sugerir otro.`}
            style={styles.gap}
          />
          <PlaceForm form={form} />
        </>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1 },
  errorBox: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  gap: { marginBottom: spacing.md },
  form: { marginTop: spacing.sm },
  link: { alignSelf: 'center', marginTop: spacing.sm },
  // Botones secundarios de la barra: ancho de 104 a 120 dp, así que se achica el relleno lateral.
  tight: { paddingHorizontal: spacing.sm },
});
