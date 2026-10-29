import { useCallback, useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { createClaim, getClaimForm, uploadClaimPhoto } from '../services/claimsApi';
import { getNeighborhoods } from '../services/catalogApi';
import { getErrorMessage } from '../services/errors';

const PICKER_OPTIONS = { mediaTypes: ['images'], quality: 0.7 };
const MAX_SUGGESTIONS = 8;

// Para buscar barrios sin importar mayúsculas ni acentos.
const plain = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Formulario de reclamo. Sirve para los dos casos: "Es mío" (publicación encontrada) y
// "Lo encontré" (publicación perdida); el servidor indica cuál corresponde en info.claimType.
export default function useClaimForm({ publicationId, onCreated }) {
  const [info, setInfo] = useState(null);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [answer, setAnswer] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null); // { uri: local, id: photoId del servidor }
  const [neighborhood, setNeighborhood] = useState(null); // { id, name }
  const [search, setSearch] = useState('');

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false); // evita el doble envío aunque el estado todavía no se haya actualizado
  const mountedRef = useRef(true); // las respuestas pueden llegar cuando la pantalla ya se cerró

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getClaimForm(publicationId);
      if (!mountedRef.current) return;
      setInfo(data);
      if (data.canClaim && data.claimType === 'found') {
        const list = await getNeighborhoods();
        if (mountedRef.current) setNeighborhoods(list);
      }
    } catch (e) {
      if (mountedRef.current) setError(getErrorMessage(e));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [publicationId]);

  useEffect(() => {
    load();
  }, [load]);

  // La foto se sube apenas se elige; el reclamo después solo manda su photoId.
  const savePhoto = async (result) => {
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setUploading(true);
    setFormError('');
    try {
      const { photoId } = await uploadClaimPhoto(uri);
      if (!mountedRef.current) return;
      setPhoto({ uri, id: photoId });
      setErrors((prev) => ({ ...prev, photo: undefined }));
    } catch (e) {
      if (mountedRef.current) setFormError(getErrorMessage(e));
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setFormError('Necesitamos permiso para acceder a tus fotos.');
    savePhoto(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setFormError('Necesitamos permiso para usar la cámara.');
    savePhoto(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
  };

  const removePhoto = () => setPhoto(null);

  const chooseNeighborhood = (item) => {
    setNeighborhood(item);
    setSearch('');
    setErrors((prev) => ({ ...prev, neighborhood: undefined }));
  };

  const query = plain(search.trim());
  const suggestions = query
    ? neighborhoods.filter((n) => plain(n.name).includes(query)).slice(0, MAX_SUGGESTIONS)
    : [];

  // Estas validaciones solo ahorran un viaje: el servidor vuelve a validar todo.
  const validate = () => {
    const next = {};
    if (info.claimType === 'mine') {
      if (!answer.trim()) next.answer = 'Escribí la respuesta a la pregunta de verificación.';
    } else {
      if (!photo) next.photo = 'Adjuntá una foto del objeto.';
      if (!neighborhood) next.neighborhood = 'Elegí el barrio donde lo encontraste.';
    }
    return next;
  };

  const onSubmit = async () => {
    if (sendingRef.current) return;
    const next = validate();
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length > 0) return;

    sendingRef.current = true;
    setSending(true);
    try {
      const body =
        info.claimType === 'mine'
          ? { verificationAnswer: answer, description, photoId: photo?.id }
          : { photoId: photo.id, foundNeighborhoodId: neighborhood.id, description };
      const claim = await createClaim(publicationId, body);
      // Si la persona ya salió de la pantalla no la navegamos a ningún lado; el reclamo quedó creado igual.
      if (mountedRef.current) onCreated?.(claim);
    } catch (e) {
      if (!mountedRef.current) return;
      setFormError(getErrorMessage(e));
      // Si el servidor cambió las reglas (intentos agotados, publicación cerrada) actualizamos el aviso.
      try {
        const data = await getClaimForm(publicationId);
        if (mountedRef.current) setInfo(data);
      } catch {
        // Sin conexión: queda el mensaje de error de arriba.
      }
    } finally {
      sendingRef.current = false;
      if (mountedRef.current) setSending(false);
    }
  };

  return {
    info, loading, error, load,
    answer, setAnswer,
    description, setDescription,
    photo, removePhoto, pickFromGallery, takePhoto,
    neighborhood, search, setSearch, suggestions, chooseNeighborhood,
    errors, formError, uploading, sending, onSubmit,
  };
}
