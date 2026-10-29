import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import Field from '../../components/Field';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import useMeetingPoint from '../../hooks/useMeetingPoint';
import { MEETING_STATUS_LABEL } from '../../constants/claims';
import { colors, spacing } from '../../constants/theme';
import { formatDateTime } from '../../utils/formatDateTime';
import { openDirections } from '../../utils/openDirections';

// Formulario para proponer un lugar (el primero, o uno distinto al vigente).
function PlaceForm({ form, submitTitle }) {
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
      <Button title={submitTitle} onPress={form.onPropose} loading={form.sending} />
    </View>
  );
}

// Se llega desde el detalle de un reclamo aceptado: navigation.navigate('MeetingPoint', { claimId }).
// El servidor indica qué puede hacer cada persona (canPropose / canAccept); la pantalla solo lo muestra.
export default function MeetingPointScreen({ route }) {
  const { claimId } = route.params;
  const form = useMeetingPoint(claimId);
  const { meeting, loading, error, load, sending, actionError } = form;

  if (loading && !meeting) return <ActivityIndicator style={styles.center} size="large" />;

  if (!meeting) {
    return (
      <View style={[styles.center, styles.errorBox]}>
        <Text style={styles.errorText}>{error}</Text>
        <Button variant="link" title="Reintentar" onPress={load} />
      </View>
    );
  }

  const point = meeting.meetingPoint;

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

  return (
    <FormScreen title="Punto de encuentro" subtitle="Coordinen dónde entregar el objeto." error={error || actionError}>
      {point ? (
        <View style={styles.point}>
          <Field label="Lugar propuesto" value={point.address} />
          {point.notes ? <Field label="Aclaración" value={point.notes} /> : null}
          <Field label="Propuesto por" value={point.proposedByMe ? 'Vos' : point.proposedBy.name} />
          <Field label="Estado" value={MEETING_STATUS_LABEL[point.status]} />
          {point.respondedAt ? <Field label="Acordado" value={formatDateTime(point.respondedAt)} /> : null}
          <View style={styles.actions}>
            <Button title="Cómo llegar" onPress={onHowToGetThere} />
          </View>
        </View>
      ) : null}

      {/* Mensaje de espera o aviso cuando esta persona no puede actuar ahora. */}
      {!meeting.canPropose && !meeting.canAccept && meeting.reason ? <Text style={styles.note}>{meeting.reason}</Text> : null}

      {meeting.canAccept ? (
        <View style={styles.actions}>
          <Button title="Aceptar este lugar" loading={sending} onPress={confirmAccept} />
          {form.showForm ? (
            <>
              <PlaceForm form={form} submitTitle="Sugerir este lugar" />
              <Button variant="link" title="Cancelar" disabled={sending} onPress={form.closeForm} />
            </>
          ) : (
            <Button variant="link" title="Proponer otro lugar" disabled={sending} onPress={form.openForm} />
          )}
        </View>
      ) : null}

      {/* Sin punto vigente, quien tiene el objeto propone el primer lugar. */}
      {!point && meeting.canPropose ? (
        <>
          <Text style={styles.note}>
            Vos tenés el objeto: proponé un lugar para entregarlo. {meeting.otherParty.name} podrá aceptarlo o sugerir otro.
          </Text>
          <PlaceForm form={form} submitTitle="Proponer lugar" />
        </>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  errorBox: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { color: colors.error, textAlign: 'center' },
  point: { marginBottom: spacing.md },
  actions: { marginTop: spacing.md },
  form: { marginTop: spacing.md },
  note: { color: colors.muted, marginVertical: spacing.md },
});
