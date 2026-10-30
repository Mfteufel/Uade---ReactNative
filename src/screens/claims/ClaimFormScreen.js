import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import NeighborhoodPicker from '../../components/NeighborhoodPicker';
import { useNetwork } from '../../context/NetworkContext';
import useClaimForm from '../../hooks/useClaimForm';
import { showOfflineToast } from '../../utils/offlineToast';
import { colors, spacing } from '../../constants/theme';

// Foto del objeto o de lo que acredita el reclamo. required solo cambia el texto de la etiqueta.
function PhotoField({ required, photo, uploading, error, onChoose, onRemove }) {
  return (
    <View style={styles.photoField}>
      <Text style={styles.label}>{required ? 'Foto del objeto' : 'Foto que acredite que es tuyo (opcional)'}</Text>
      {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} /> : null}
      {uploading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={styles.photoActions}>
          <Button variant="link" title={photo ? 'Cambiar foto' : 'Agregar foto'} onPress={onChoose} />
          {photo ? <Button variant="link" title="Quitar" onPress={onRemove} /> : null}
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

// Se llega desde el detalle de una publicación: navigation.navigate('ClaimForm', { publicationId }).
// El servidor dice qué tipo de reclamo corresponde ("Es mío" o "Lo encontré"), no la pantalla.
export default function ClaimFormScreen({ route, navigation }) {
  const { isOnline } = useNetwork();
  const { publicationId } = route.params;
  const form = useClaimForm({
    publicationId,
    onCreated: (claim) => navigation.replace('ClaimDetail', { claimId: claim.id }),
  });
  const { info, loading, error, load, errors, formError } = form;

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;

  if (error || !info) {
    return (
      <View style={[styles.center, styles.errorBox]}>
        <Text style={styles.errorText}>{error}</Text>
        <Button variant="link" title="Reintentar" onPress={load} />
      </View>
    );
  }

  const isMine = info.claimType === 'mine';
  const title = isMine ? 'Es mío' : 'Lo encontré';

  if (!info.canClaim) {
    return (
      <FormScreen title={title} subtitle={info.title}>
        <Text style={styles.blocked}>{info.reason}</Text>
      </FormScreen>
    );
  }

  const onChoosePhoto = () =>
    Alert.alert('Foto', 'Elegí de dónde sacar la foto', [
      { text: 'Galería', onPress: form.pickFromGallery },
      { text: 'Cámara', onPress: form.takePhoto },
      { text: 'Cancelar', style: 'cancel' },
    ]);

  return (
    <FormScreen title={title} subtitle={info.title} error={formError}>
      <Text style={styles.attempts}>
        {info.attemptsLeft === 1 ? 'Te queda 1 intento' : `Te quedan ${info.attemptsLeft} intentos`} para esta publicación.
      </Text>

      {isMine ? (
        <>
          <Text style={styles.question}>{info.verificationQuestion}</Text>
          <Input label="Tu respuesta" value={form.answer} onChangeText={form.setAnswer} error={errors.answer} />
          <Input
            label="Descripción (opcional)"
            value={form.description}
            onChangeText={form.setDescription}
            placeholder="Algo más que ayude a comprobar que es tuyo"
            multiline
            style={styles.multiline}
          />
        </>
      ) : (
        <NeighborhoodPicker
          label="Barrio donde lo encontraste"
          selected={form.neighborhood}
          search={form.search}
          onSearchChange={form.setSearch}
          suggestions={form.suggestions}
          onSelect={form.chooseNeighborhood}
          error={errors.neighborhood}
        />
      )}

      <PhotoField
        required={!isMine}
        photo={form.photo}
        uploading={form.uploading}
        error={errors.photo}
        onChoose={onChoosePhoto}
        onRemove={form.removePhoto}
      />

      <Button
        title="Enviar reclamo"
        onPress={isOnline ? form.onSubmit : () => showOfflineToast()}
        loading={form.sending}
        disabled={form.uploading}
        dimmed={!isOnline}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  errorBox: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { color: colors.error, textAlign: 'center' },
  blocked: { color: colors.text, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md },
  attempts: { color: colors.muted, marginBottom: spacing.md },
  question: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  label: { color: colors.text, fontWeight: '500', marginBottom: spacing.xs },
  photoField: { marginBottom: spacing.md },
  photo: { width: '100%', height: 200, borderRadius: 8, backgroundColor: colors.surface, marginBottom: spacing.xs },
  photoActions: { flexDirection: 'row', alignItems: 'center' },
  error: { color: colors.error, fontSize: 13 },
});
