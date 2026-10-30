import { useState } from 'react';
import { Alert, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Banner from '../../components/Banner';
import BottomActionBar from '../../components/BottomActionBar';
import Button from '../../components/Button';
import DateStepper from '../../components/DateStepper';
import Field from '../../components/Field';
import FormScreen from '../../components/FormScreen';
import Icon from '../../components/Icon';
import Input from '../../components/Input';
import ListRow from '../../components/ListRow';
import NeighborhoodPicker from '../../components/NeighborhoodPicker';
import OptionChips from '../../components/OptionChips';
import PhotoGrid from '../../components/PhotoGrid';
import Sheet from '../../components/Sheet';
import StepProgress from '../../components/StepProgress';
import usePublishForm from '../../hooks/usePublishForm';
import { CATEGORIES, categoryName } from '../../constants/categories';
import { MAX_PHOTOS, PUBLICATION_TYPES, TIME_SLOTS, timeSlotName } from '../../constants/publications';
import { colors, radius, spacing, typography } from '../../constants/theme';
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

// Nombre corto del paso para StepProgress.
const STEP_NAMES = {
  type: 'Tipo',
  photos: 'Fotos',
  details: 'Qué es',
  place: 'Dónde',
  verification: 'Verificación',
  review: 'Revisión',
};

// Ícono de cada tipo en las tarjetas del primer paso.
const TYPE_ICONS = { lost: 'search', found: 'pin' };

// Params opcionales: { type: 'lost' | 'found' } (el buscador lo manda cuando no encontró resultados).
export default function PublishScreen({ navigation, route }) {
  const form = usePublishForm({
    initialType: route.params?.type,
    onPublished: ({ pending }) => {
      if (pending) {
        Alert.alert('Pendiente de envío', 'Dispositivo sin conexión, tu publicación será creada cuando la conexión se restablezca.');
      } else {
        Alert.alert('¡Listo!', 'Tu publicación ya está visible.');
      }
      navigation.replace('MyPublications');
    },
  });
  const { draft, steps, stepName } = form;

  if (!draft) return <ActivityIndicator style={styles.center} size="large" />;

  const isLast = draft.step === steps.length - 1;

  const typeChosen = !!draft.type;
  const disabledNext = stepName === 'type' && !typeChosen;

  const footer = (
    <BottomActionBar note={typeChosen ? 'Borrador guardado hace un instante.' : undefined}>
      {draft.step > 0 ? (
        <Button variant="secondary" title="Atrás" onPress={form.goBack} disabled={form.publishing} />
      ) : null}
      {isLast ? (
        <Button
          variant="accent"
          title="Publicar"
          loadingTitle="Publicando…"
          onPress={form.publish}
          loading={form.publishing}
        />
      ) : (
        <Button
          title="Siguiente"
          onPress={form.goNext}
          disabled={disabledNext}
          disabledReason={disabledNext ? 'Elegí qué te pasó para empezar.' : undefined}
        />
      )}
    </BottomActionBar>
  );

  return (
    <FormScreen title={STEP_TITLES[stepName]} error={form.formError} footer={footer}>
      <View style={styles.progress}>
        <StepProgress current={draft.step + 1} total={steps.length} name={STEP_NAMES[stepName]} />
      </View>

      {form.restored ? (
        <View style={styles.block}>
          <Banner kind="info" message="Seguís con el borrador que habías dejado sin publicar." />
          <Button variant="link" title="Descartarlo y empezar de nuevo" onPress={form.discardDraft} />
        </View>
      ) : null}

      {!form.isOnline && isLast ? (
        <View style={styles.block}>
          <Banner
            kind="warn"
            message="Dispositivo sin conexión, tu publicación será creada cuando la conexión se restablezca."
          />
        </View>
      ) : null}

      {stepName === 'type' ? <TypeStep form={form} /> : null}
      {stepName === 'photos' ? <PhotosStep form={form} /> : null}
      {stepName === 'details' ? <DetailsStep form={form} /> : null}
      {stepName === 'place' ? <PlaceStep form={form} /> : null}
      {stepName === 'verification' ? <VerificationStep form={form} /> : null}
      {stepName === 'review' ? <ReviewStep draft={draft} /> : null}
    </FormScreen>
  );
}

function TypeStep({ form }) {
  const selectedId = form.draft.type;
  return (
    <View>
      {PUBLICATION_TYPES.map((option) => {
        const selected = option.id === selectedId;
        return (
          <Pressable
            key={option.id}
            onPress={() => form.setField('type', option.id)}
            accessibilityRole="button"
            accessibilityLabel={option.name}
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.typeCard, selected && styles.typeCardSelected, pressed && styles.typeCardPressed]}
          >
            <Icon name={TYPE_ICONS[option.id] || 'tag'} size={32} color={selected ? colors.blue600 : colors.textDim} />
            <Text style={[styles.typeName, selected && styles.typeNameSelected]}>{option.name}</Text>
            {selected ? <Icon name="check" size={24} color={colors.blue600} /> : null}
          </Pressable>
        );
      })}
      {form.errors.type ? (
        <View style={styles.errorRow}>
          <Icon name="warning" size={20} color={colors.danger} />
          <Text style={styles.errorText}>{form.errors.type}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PhotosStep({ form }) {
  const { photos } = form.draft;
  const [sheetOpen, setSheetOpen] = useState(false);
  const full = photos.length >= MAX_PHOTOS;
  // Cierra la hoja y recién después abre la cámara o la galería.
  const choose = (action) => {
    setSheetOpen(false);
    action();
  };
  return (
    <View>
      <Text style={styles.help}>
        Podés sumar hasta {MAX_PHOTOS} fotos. No es obligatorio, pero ayuda mucho a reconocerlo.
      </Text>
      <PhotoGrid uris={photos} onRemove={form.removePhoto} onAdd={() => setSheetOpen(true)} max={MAX_PHOTOS} />
      <Text style={styles.counter}>{`${photos.length} de ${MAX_PHOTOS}`}</Text>
      {full ? <Text style={styles.help}>Llegaste al máximo de fotos.</Text> : null}
      <Banner kind="warn" message="Si es un documento, tapá el número antes de sacar la foto." />
      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Agregar una foto">
        <ListRow icon="camera" title="Sacar una foto" onPress={() => choose(form.takePhoto)} />
        <ListRow icon="image" title="Elegir de la galería" onPress={() => choose(form.pickFromGallery)} last />
      </Sheet>
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
      <Text style={styles.titleCounter} accessibilityLabel={`${draft.title.length} de 80 caracteres`}>
        {`${draft.title.length}/80`}
      </Text>
      <Input
        label="Descripción (opcional)"
        value={draft.description}
        onChangeText={(text) => setField('description', text)}
        placeholder="Detalles que ayuden a reconocerlo"
        multiline
        maxLength={500}
        textAlignVertical="top"
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
      {errors.occurredOn ? (
        <View style={styles.errorRow}>
          <Icon name="warning" size={20} color={colors.danger} />
          <Text style={styles.errorText}>{errors.occurredOn}</Text>
        </View>
      ) : null}
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
  const hasLocation = draft.latitude !== null && draft.latitude !== undefined;
  return (
    <View>
      {form.neighborhoodsError ? (
        <View style={styles.block}>
          <Banner kind="warn" message={`No se pudieron cargar los barrios. ${form.neighborhoodsError}`} />
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
      {hasLocation ? (
        <View style={styles.location}>
          <View style={styles.locationField}>
            <Icon name="location" size={24} color={colors.blue600} />
            <Text style={styles.locationText}>
              Ubicación cargada ({draft.latitude}, {draft.longitude})
            </Text>
          </View>
          <Button variant="link" title="Quitar ubicación" onPress={form.clearLocation} />
        </View>
      ) : (
        <Pressable
          onPress={form.fillCurrentLocation}
          disabled={form.locating}
          accessibilityRole="button"
          accessibilityLabel="Usar mi ubicación actual"
          accessibilityState={{ disabled: form.locating, busy: form.locating }}
          style={({ pressed }) => [styles.locationField, styles.location, pressed && styles.locationPressed]}
        >
          <Icon name="location" size={24} color={colors.blue600} />
          <Text style={styles.locationText}>{form.locating ? 'Buscando tu ubicación…' : 'Usar mi ubicación actual'}</Text>
        </Pressable>
      )}
      {form.locationError ? (
        <View style={styles.errorRow}>
          <Icon name="warning" size={20} color={colors.danger} />
          <Text style={styles.errorText}>{form.locationError}</Text>
        </View>
      ) : null}
      <Banner
        kind="info"
        message="Nadie ve esta dirección. En la publicación se muestra sólo el barrio, hasta que aceptes un reclamo."
      />
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
      <Banner
        kind="info"
        message="La respuesta no se muestra a nadie. La guardamos para compararla con lo que te contesten; ni nosotros la mostramos en la publicación."
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
  progress: { marginBottom: spacing.lg },
  block: { marginBottom: spacing.md },
  help: { ...typography.body, color: colors.textDim, marginBottom: spacing.md },
  counter: { ...typography.meta, color: colors.textDim, marginBottom: spacing.md },
  titleCounter: { ...typography.meta, color: colors.textDim, textAlign: 'right', marginTop: -spacing.md, marginBottom: spacing.md },
  multiline: { minHeight: 96, paddingTop: spacing.ms },
  typeCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.card,
    marginBottom: spacing.ms,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
  },
  typeCardSelected: { backgroundColor: colors.blue50, borderColor: colors.blue600, borderWidth: 1.5 },
  typeCardPressed: { backgroundColor: colors.blue50 },
  typeName: { ...typography.section, flex: 1, color: colors.text },
  typeNameSelected: { color: colors.blue600 },
  location: { marginBottom: spacing.md },
  locationField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.field,
    backgroundColor: colors.bg,
  },
  locationPressed: { backgroundColor: colors.blue50 },
  locationText: { ...typography.body, flex: 1, color: colors.text },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  errorText: { ...typography.body, flex: 1, color: colors.danger },
});
