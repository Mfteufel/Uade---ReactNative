import { useCallback, useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { usePendingPublications } from '../context/PendingPublicationsContext';
import { createPublication, getNeighborhoodsForPublish } from '../services/publicationsApi';
import { clearDraft, loadDraft, saveDraft } from '../services/publicationDraft';
import { getErrorMessage, isNetworkError } from '../services/errors';
import { MAX_PHOTOS, TIME_SLOTS } from '../constants/publications';
import { addDays, todayApiDate } from '../utils/dates';
import { createUuid } from '../utils/uuid';

const PICKER_OPTIONS = { mediaTypes: ['images'], quality: 0.7 };
const MAX_SUGGESTIONS = 8;
const LOCATION_TIMEOUT_MS = 15000;

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo agotado')), ms))]);

const plain = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// El clientId se crea una sola vez por borrador: si el envío se corta y se reintenta, el servidor no duplica.
const emptyDraft = (type = null) => ({
  clientId: createUuid(),
  step: 0,
  type,
  photos: [],
  title: '',
  description: '',
  categoryId: null,
  occurredOn: todayApiDate(),
  timeSlot: null, // opcional, id de TIME_SLOTS
  neighborhood: null,
  exactAddress: '',
  latitude: null,
  longitude: null,
  verificationQuestion: '',
  verificationAnswer: '',
});

// La pregunta de verificación solo se pide si la persona encontró algo.
export const stepsFor = (type) => [
  'type',
  'photos',
  'details',
  'place',
  ...(type === 'found' ? ['verification'] : []),
  'review',
];

function validateStep(step, d) {
  const errors = {};
  if (step === 'type' && !d.type) errors.type = 'Elegí una opción.';
  if (step === 'details') {
    if (!d.title.trim()) errors.title = 'Escribí un título.';
    if (!d.categoryId) errors.categoryId = 'Elegí una categoría.';
    if (!d.occurredOn || d.occurredOn > todayApiDate()) errors.occurredOn = 'La fecha no puede ser futura.';
  }
  if (step === 'place') {
    if (!d.neighborhood) errors.neighborhood = 'Elegí el barrio.';
    const hasLocation = d.latitude !== null && d.latitude !== undefined;
    if (!d.exactAddress.trim() && !hasLocation) errors.exactAddress = 'Escribí la dirección o usá tu ubicación actual.';
  }
  if (step === 'verification') {
    if (!d.verificationQuestion.trim()) errors.verificationQuestion = 'Escribí una pregunta.';
    if (!d.verificationAnswer.trim()) errors.verificationAnswer = 'Escribí la respuesta.';
  }
  return errors;
}

function toRequestBody(d) {
  const isFound = d.type === 'found';
  const slot = TIME_SLOTS.find((s) => s.id === d.timeSlot);
  return {
    clientId: d.clientId,
    type: d.type,
    title: d.title.trim(),
    description: d.description.trim() || null,
    categoryId: d.categoryId,
    occurredOn: d.occurredOn,
    timeFrom: slot ? slot.timeFrom : null,
    timeTo: slot ? slot.timeTo : null,
    neighborhoodId: d.neighborhood.id,
    exactAddress: d.exactAddress.trim() || null,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    verificationQuestion: isFound ? d.verificationQuestion.trim() : null,
    verificationAnswer: isFound ? d.verificationAnswer.trim() : null,
  };
}

// "Av. Santa Fe 3200" a partir de lo que devuelve el geocoder del celular.
function addressFromPlace(place) {
  if (!place) return '';
  if (place.street) return `${place.street} ${place.streetNumber || ''}`.trim();
  return place.name || '';
}

// initialType: 'lost' | 'found' cuando se llega desde el buscador sin resultados.
export default function usePublishForm({ initialType, onPublished }) {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { enqueue } = usePendingPublications();
  const [draft, setDraft] = useState(null); // null mientras se lee el borrador guardado
  const [restored, setRestored] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false); // evita el doble toque en "Publicar"

  const [neighborhoods, setNeighborhoods] = useState([]);
  const [neighborhoodsError, setNeighborhoodsError] = useState('');
  const [search, setSearch] = useState('');

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const locatingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadDraft(user.id)
      .catch(() => null)
      .then((saved) => {
        if (cancelled) return;
        // Si había un borrador, gana el borrador. Lo completamos con uno vacío por si le falta algún campo.
        setDraft(saved ? { ...emptyDraft(initialType), ...saved } : emptyDraft(initialType));
        setRestored(!!saved);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  // Cada cambio se guarda al toque: si la persona sale de la app, al volver sigue donde estaba.
  useEffect(() => {
    if (draft?.type) saveDraft(user.id, draft).catch(() => {});
  }, [draft, user.id]);

  const loadNeighborhoods = useCallback(async () => {
    setNeighborhoodsError('');
    try {
      setNeighborhoods(await getNeighborhoodsForPublish());
    } catch (e) {
      setNeighborhoodsError(getErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    loadNeighborhoods();
  }, [loadNeighborhoods]);

  // Si no había barrios guardados, se vuelven a pedir cuando vuelve la conexión. Solo al pasar de
  // sin conexión a con conexión: si el servidor falla estando conectado, no queda reintentando en bucle.
  const wasOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !wasOnlineRef.current && neighborhoodsError) loadNeighborhoods();
    wasOnlineRef.current = isOnline;
  }, [isOnline, neighborhoodsError, loadNeighborhoods]);

  const setField = (name, value) => {
    setDraft((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const steps = draft ? stepsFor(draft.type) : [];
  const stepName = draft ? steps[draft.step] : null;

  const goNext = () => {
    const found = validateStep(stepName, draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setDraft((prev) => ({ ...prev, step: prev.step + 1 }));
  };

  const goBack = () => {
    setErrors({});
    setFormError('');
    setDraft((prev) => ({ ...prev, step: prev.step - 1 }));
  };

  const addPhotos = (result) => {
    if (result.canceled) return;
    const uris = result.assets.map((asset) => asset.uri);
    setDraft((prev) => ({ ...prev, photos: [...prev.photos, ...uris].slice(0, MAX_PHOTOS) }));
  };

  const pickFromGallery = async () => {
    setFormError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setFormError('Necesitamos permiso para acceder a tus fotos.');
    addPhotos(
      await ImagePicker.launchImageLibraryAsync({
        ...PICKER_OPTIONS,
        allowsMultipleSelection: true,
        selectionLimit: MAX_PHOTOS - draft.photos.length,
      }),
    );
  };

  const takePhoto = async () => {
    setFormError('');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setFormError('Necesitamos permiso para usar la cámara.');
    addPhotos(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
  };

  const removePhoto = (uri) => setDraft((prev) => ({ ...prev, photos: prev.photos.filter((p) => p !== uri) }));

  const setDaysAgo = (days) => setField('occurredOn', addDays(todayApiDate(), -days));

  // Tocar la franja elegida la deselecciona (es opcional).
  const toggleTimeSlot = (id) => setField('timeSlot', draft.timeSlot === id ? null : id);

  const chooseNeighborhood = (item) => {
    setField('neighborhood', { id: item.id, name: item.name });
    setSearch('');
  };

  const query = plain(search.trim());
  const suggestions = query
    ? neighborhoods.filter((n) => plain(n.name).includes(query)).slice(0, MAX_SUGGESTIONS)
    : [];

  const fillCurrentLocation = async () => {
    if (locatingRef.current) return;
    locatingRef.current = true;
    setLocating(true);
    setLocationError('');
    try {
      // El permiso se pide recién acá, cuando la persona toca el botón.
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError('Necesitamos permiso para usar tu ubicación. Podés escribir la dirección.');
        return;
      }
      // Sin conexión, la precisión Balanced (wifi y antenas) se queda esperando: usamos el GPS.
      // Con tope de tiempo y, si no llega, la última ubicación conocida.
      const accuracy = isOnline ? Location.Accuracy.Balanced : Location.Accuracy.High;
      const position = await withTimeout(Location.getCurrentPositionAsync({ accuracy }), LOCATION_TIMEOUT_MS)
        .catch(() => Location.getLastKnownPositionAsync());
      if (!position) throw new Error('Sin ubicación');
      const { coords } = position;
      let address = '';
      // Pasar de coordenadas a dirección necesita internet.
      if (isOnline) {
        try {
          const [place] = await withTimeout(Location.reverseGeocodeAsync(coords), LOCATION_TIMEOUT_MS);
          address = addressFromPlace(place);
        } catch {
          // Sin dirección sugerida igual sirven las coordenadas.
        }
      }
      setDraft((prev) => ({
        ...prev,
        latitude: Number(coords.latitude.toFixed(6)),
        longitude: Number(coords.longitude.toFixed(6)),
        exactAddress: prev.exactAddress.trim() ? prev.exactAddress : address,
      }));
      setErrors((prev) => ({ ...prev, exactAddress: undefined }));
    } catch {
      setLocationError('No pudimos obtener tu ubicación. Revisá que la ubicación del celular esté activada.');
    } finally {
      locatingRef.current = false;
      setLocating(false);
    }
  };

  const clearLocation = () => setDraft((prev) => ({ ...prev, latitude: null, longitude: null }));

  const discardDraft = async () => {
    await clearDraft(user.id).catch(() => {});
    setDraft(emptyDraft(initialType));
    setRestored(false);
    setErrors({});
    setFormError('');
  };

  const publish = async () => {
    if (publishingRef.current) return;
    // Un borrador viejo puede tener algún paso a medias: si falla uno, volvemos a ese paso.
    for (const [index, name] of steps.entries()) {
      const found = validateStep(name, draft);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        setDraft((prev) => ({ ...prev, step: index }));
        return;
      }
    }

    publishingRef.current = true;
    setPublishing(true);
    setFormError('');
    try {
      const body = toRequestBody(draft);
      let pending = !isOnline;
      if (!pending) {
        try {
          await createPublication(body, draft.photos);
        } catch (e) {
          // Si se cortó en el medio queda pendiente: al reenviarla, el clientId evita que se duplique.
          if (!isNetworkError(e)) throw e;
          pending = true;
        }
      }
      if (pending) await enqueue(body, draft.photos, draft.neighborhood.name);
      await clearDraft(user.id).catch(() => {});
      onPublished?.({ pending });
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  };

  return {
    isOnline,
    draft, steps, stepName, restored,
    errors, formError, publishing,
    setField, goNext, goBack, discardDraft, publish,
    pickFromGallery, takePhoto, removePhoto,
    setDaysAgo, toggleTimeSlot,
    neighborhoodsError, loadNeighborhoods,
    search, setSearch, suggestions, chooseNeighborhood,
    locating, locationError, fillCurrentLocation, clearLocation,
  };
}
