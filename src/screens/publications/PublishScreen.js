import { Alert, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import DateStepper from '../../components/DateStepper';
import Field from '../../components/Field';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import NeighborhoodPicker from '../../components/NeighborhoodPicker';
import OptionChips from '../../components/OptionChips';
import PhotoGrid from '../../components/PhotoGrid';
import usePublishForm from '../../hooks/usePublishForm';
import { CATEGORIES, categoryName } from '../../constants/categories';
import { MAX_PHOTOS, PUBLICATION_TYPES, TIME_SLOTS, timeSlotName } from '../../constants/publications';
import { colors, spacing } from '../../constants/theme';
import { daysAgo, formatApiDate, todayApiDate } from '../../utils/dates';

const QUICK_DATES = [
  { id: '0', name: 'Hoy' },
  { id: '1', name: 'Ayer' },
  { id: '2', name: 'Hace 2 días' },
];

const STEP_TITLES = {
  type: '¿Qué te pasó?',
  photos: 'Fotos',
  details: '¿Qué es y cuándo pasó?',
  place: '¿Dónde?',
  verification: 'Pregunta de verificación',
  review: 'Revisá antes de publicar',
};

// Params opcionales: { type: 'lost' | 'found' } (el buscador lo manda cuando no encontró resultados).
export default function PublishScreen({ navigation, route }) {
  const form = usePublishForm({
    initialType: route.params?.type,
    onPublished: () => {
      Alert.alert('¡Listo!', 'Tu publicación ya está visible.');
      navigation.replace('MyPublications');
    },
  });
  const { draft, steps, stepName } = form;

  if (!draft) return <ActivityIndicator style={styles.center} size="large" />;

  const isLast = draft.step === steps.length - 1;

  return (
    <FormScreen title={STEP_TITLES[stepName]} subtitle={`Paso ${draft.step + 1} de ${steps.length}`} error={form.formError}>
      {form.restored ? (
        <View style={styles.restored}>
          <Text style={styles.restoredText}>Seguís con el borrador que habías dejado sin publicar.</Text>
          <Button variant="link" title="Descartarlo y empezar de nuevo" onPress={form.discardDraft} />
        </View>
      ) : null}

      {stepName === 'type' ? <TypeStep form={form} /> : null}
      {stepName === 'photos' ? <PhotosStep form={form} /> : null}
      {stepName === 'details' ? <DetailsStep form={form} /> : null}
      {stepName === 'place' ? <PlaceStep form={form} /> : null}
      {stepName === 'verification' ? <VerificationStep form={form} /> : null}
      {stepName === 'review' ? <ReviewStep draft={draft} /> : null}

      <View style={styles.actions}>
        {isLast ? (
          <Button title="Publicar" onPress={form.publish} loading={form.publishing} />
        ) : (
          <Button title="Siguiente" onPress={form.goNext} />
        )}
        {draft.step > 0 ? <Button variant="link" title="Atrás" onPress={form.goBack} disabled={form.publishing} /> : null}
      </View>
    </FormScreen>
  );
}

function TypeStep({ form }) {
  return (
    <OptionChips
      options={PUBLICATION_TYPES}
      selectedId={form.draft.type}
      onSelect={(type) => form.setField('type', type)}
      error={form.errors.type}
    />
  );
}

function PhotosStep({ form }) {
  const { photos } = form.draft;
  const full = photos.length >= MAX_PHOTOS;
  return (
    <View>
      <Text style={styles.help}>
        Podés sumar hasta {MAX_PHOTOS} fotos. No es obligatorio, pero ayuda mucho a reconocerlo.
      </Text>
      <PhotoGrid uris={photos} onRemove={form.removePhoto} />
      {full ? (
        <Text style={styles.help}>Llegaste al máximo de fotos.</Text>
      ) : (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button variant="link" title="Sacar foto" onPress={form.takePhoto} />
          </View>
          <View style={styles.flex}>
            <Button variant="link" title="Elegir de la galería" onPress={form.pickFromGallery} />
          </View>
        </View>
      )}
    </View>
  );
}

function DetailsStep({ form }) {
  const { draft, errors, setField } = form;
  return (
    <View>
      <Input
        label="Título"
        value={draft.title}
        onChangeText={(text) => setField('title', text)}
        error={errors.title}
        placeholder="Ej: Llaves con llavero rojo"
        maxLength={80}
      />
      <Input
        label="Descripción (opcional)"
        value={draft.description}
        onChangeText={(text) => setField('description', text)}
        placeholder="Detalles que ayuden a reconocerlo"
        multiline
        maxLength={500}
        style={styles.multiline}
      />
      <OptionChips
        label="Categoría"
        options={CATEGORIES}
        selectedId={draft.categoryId}
        onSelect={(id) => setField('categoryId', id)}
        error={errors.categoryId}
      />
      <OptionChips
        label="¿Cuándo pasó?"
        options={QUICK_DATES}
        selectedId={String(daysAgo(draft.occurredOn))}
        onSelect={(id) => form.setDaysAgo(Number(id))}
      />
      <DateStepper value={draft.occurredOn} onChange={(date) => setField('occurredOn', date)} maxDate={todayApiDate()} />
      {errors.occurredOn ? <Text style={styles.errorText}>{errors.occurredOn}</Text> : null}
      <OptionChips
        label="Franja horaria (opcional)"
        options={TIME_SLOTS}
        selectedId={draft.timeSlot}
        onSelect={form.toggleTimeSlot}
      />
    </View>
  );
}

function PlaceStep({ form }) {
  const { draft, errors, setField } = form;
  return (
    <View>
      {form.neighborhoodsError ? (
        <View style={styles.restored}>
          <Text style={styles.errorText}>No se pudieron cargar los barrios. {form.neighborhoodsError}</Text>
          <Button variant="link" title="Reintentar" onPress={form.loadNeighborhoods} />
        </View>
      ) : null}
      <NeighborhoodPicker
        label="Barrio"
        selected={draft.neighborhood}
        search={form.search}
        onSearchChange={form.setSearch}
        suggestions={form.suggestions}
        onSelect={form.chooseNeighborhood}
        error={errors.neighborhood}
      />
      <Input
        label="Dirección exacta"
        value={draft.exactAddress}
        onChangeText={(text) => setField('exactAddress', text)}
        error={errors.exactAddress}
        placeholder="Ej: Av. Santa Fe 3200, en la parada del 152"
        maxLength={200}
      />
      {draft.latitude !== null && draft.latitude !== undefined ? (
        <View style={styles.location}>
          <Text style={styles.restoredText}>
            📍 Ubicación cargada ({draft.latitude}, {draft.longitude})
          </Text>
          <Button variant="link" title="Quitar ubicación" onPress={form.clearLocation} />
        </View>
      ) : (
        <Button variant="link" title="Usar mi ubicación actual" onPress={form.fillCurrentLocation} loading={form.locating} />
      )}
      {form.locationError ? <Text style={styles.errorText}>{form.locationError}</Text> : null}
      <Text style={styles.help}>La dirección exacta no se muestra hasta que aceptes un reclamo.</Text>
    </View>
  );
}

function VerificationStep({ form }) {
  const { draft, errors, setField } = form;
  return (
    <View>
      <Text style={styles.help}>
        Preguntá por un detalle que no se vea en las fotos. Así el dueño puede demostrar que es suyo.
      </Text>
      <Input
        label="Pregunta"
        value={draft.verificationQuestion}
        onChangeText={(text) => setField('verificationQuestion', text)}
        error={errors.verificationQuestion}
        placeholder="Ej: ¿De qué color es el llavero?"
        maxLength={200}
      />
      <Input
        label="Respuesta (privada, solo la ves vos)"
        value={draft.verificationAnswer}
        onChangeText={(text) => setField('verificationAnswer', text)}
        error={errors.verificationAnswer}
        placeholder="Ej: Rojo"
        maxLength={200}
      />
    </View>
  );
}

function ReviewStep({ draft }) {
  const type = PUBLICATION_TYPES.find((t) => t.id === draft.type)?.name;
  const time = draft.timeSlot ? ` · ${timeSlotName(draft.timeSlot)}` : '';
  return (
    <View>
      {draft.photos.length > 0 ? <PhotoGrid uris={draft.photos} /> : <Text style={styles.help}>Sin fotos.</Text>}
      <Field label="Tipo" value={type} />
      <Field label="Título" value={draft.title} />
      {draft.description ? <Field label="Descripción" value={draft.description} /> : null}
      <Field label="Categoría" value={categoryName(draft.categoryId)} />
      <Field label="Cuándo" value={`${formatApiDate(draft.occurredOn)}${time}`} />
      <Field label="Barrio" value={draft.neighborhood?.name} />
      {draft.exactAddress ? <Field label="Dirección (privada)" value={draft.exactAddress} /> : null}
      {draft.latitude !== null && draft.latitude !== undefined ? (
        <Field label="Coordenadas" value={`${draft.latitude}, ${draft.longitude}`} />
      ) : null}
      {draft.type === 'found' ? (
        <>
          <Field label="Pregunta de verificación" value={draft.verificationQuestion} />
          <Field label="Respuesta (privada)" value={draft.verificationAnswer} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  help: { color: colors.muted, marginBottom: spacing.md },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  actions: { marginTop: spacing.lg },
  location: { marginBottom: spacing.sm },
  restored: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.md },
  restoredText: { color: colors.text },
  errorText: { color: colors.error },
});
