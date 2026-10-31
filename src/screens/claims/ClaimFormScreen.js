import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import Banner from '../../components/Banner';
import BottomActionBar from '../../components/BottomActionBar';
import Button from '../../components/Button';
import FormScreen from '../../components/FormScreen';
import Icon from '../../components/Icon';
import Input from '../../components/Input';
import ListRow from '../../components/ListRow';
import NeighborhoodPicker from '../../components/NeighborhoodPicker';
import Sheet from '../../components/Sheet';
import { useNetwork } from '../../context/NetworkContext';
import useClaimForm from '../../hooks/useClaimForm';
import { showOfflineToast } from '../../utils/offlineToast';
import { colors, radius, spacing, typography } from '../../constants/theme';

// Foto del objeto o de lo que acredita el reclamo. required cambia la etiqueta y agrega la explicación.
function PhotoField({ required, photo, uploading, error, onChoose, onRemove }) {
  return (
    <View style={styles.photoField}>
      <Text style={styles.label}>{required ? 'Foto del objeto' : 'Foto que acredite que es tuyo (opcional)'}</Text>
      {required ? <Text style={styles.help}>Es la prueba de que lo tenés vos.</Text> : null}
      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.photo} accessibilityLabel="Foto elegida para el reclamo" />
      ) : null}
      {uploading ? (
        <ActivityIndicator color={colors.blue600} accessibilityLabel="Subiendo la foto" />
      ) : (
        <View style={styles.photoActions}>
          <Button
            variant={photo ? 'link' : 'secondary'}
            icon={photo ? undefined : 'camera'}
            title={photo ? 'Cambiar foto' : 'Agregar foto'}
            onPress={onChoose}
          />
          {photo ? <Button variant="link" title="Quitar" onPress={onRemove} /> : null}
        </View>
      )}
      {error ? (
        <View style={styles.errorRow} accessibilityRole="alert">
          <Icon name="warning" size={20} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const { info, loading, error, load, errors, formError } = form;

  if (loading) return <ActivityIndicator style={styles.center} size="large" color={colors.blue600} />;

  if (error || !info) {
    return (
      <View style={[styles.center, styles.errorBox]}>
        <Banner kind="warn" message={error} />
        <Button variant="link" title="Reintentar" onPress={load} />
      </View>
    );
  }

  const isMine = info.claimType === 'mine';
  const title = isMine ? 'Es mío' : 'Lo encontré';

  if (!info.canClaim) {
    return (
      <FormScreen title={title} subtitle={info.title}>
        <Banner kind="warn" message={info.reason} />
      </FormScreen>
    );
  }

  // Cierra la hoja y recién después abre la cámara o la galería.
  const choose = (action) => {
    setSheetOpen(false);
    action();
  };

  // C7: la API no informa el máximo de intentos, solo los que quedan; vale para los dos tipos de reclamo.
  const attemptsNote = `${
    info.attemptsLeft === 1 ? 'Te queda 1 intento' : `Te quedan ${info.attemptsLeft} intentos`
  } para esta publicación.`;

  const photoField = (
    <PhotoField
      required={!isMine}
      photo={form.photo}
      uploading={form.uploading}
      error={errors.photo}
      onChoose={() => setSheetOpen(true)}
      onRemove={form.removePhoto}
    />
  );

  // Un solo primario, sin «Cancelar» (volver es el gesto de atrás). Sin conexión se ve atenuado
  // pero responde con el aviso. La validación sigue en el hook: los errores se muestran en cada campo.
  const footer = (
    <BottomActionBar note={attemptsNote}>
      <Button
        title={isMine ? 'Enviar reclamo' : 'Enviar aviso'}
        loadingTitle="Enviando…"
        onPress={isOnline ? form.onSubmit : () => showOfflineToast()}
        loading={form.sending}
        disabled={form.uploading}
        disabledReason={form.uploading ? 'Esperá a que termine de subirse la foto.' : undefined}
        dimmed={!isOnline}
      />
    </BottomActionBar>
  );

  return (
    <FormScreen title={title} subtitle={info.title} error={formError} footer={footer}>
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
          {photoField}
        </>
      ) : (
        <>
          {photoField}
          <NeighborhoodPicker
            label="Barrio donde lo encontraste"
            selected={form.neighborhood}
            search={form.search}
            onSearchChange={form.setSearch}
            suggestions={form.suggestions}
            onSelect={form.chooseNeighborhood}
            error={errors.neighborhood}
          />
          <Input
            label="Relato (opcional)"
            value={form.description}
            onChangeText={form.setDescription}
            placeholder="Contanos dónde y cómo lo encontraste"
            multiline
            style={styles.multiline}
          />
        </>
      )}

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Agregar una foto">
        <ListRow icon="camera" title="Sacar una foto" onPress={() => choose(form.takePhoto)} />
        <ListRow icon="image" title="Elegir de la galería" onPress={() => choose(form.pickFromGallery)} last />
      </Sheet>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg },
  errorBox: { alignItems: 'stretch', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  question: { ...typography.bodyStrong, fontSize: 16, fontWeight: '500', color: colors.text, marginBottom: spacing.xs },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  label: { ...typography.caption, color: colors.textDim, marginBottom: spacing.xs },
  help: { ...typography.body, color: colors.text, marginBottom: spacing.sm },
  photoField: { marginBottom: spacing.formGap },
  photo: { width: '100%', height: 200, borderRadius: radius.button, backgroundColor: colors.surface, marginBottom: spacing.sm },
  photoActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  error: { ...typography.body, flex: 1, color: colors.danger },
});
