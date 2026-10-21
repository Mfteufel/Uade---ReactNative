import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { updateMe, uploadPhoto } from '../services/userApi';
import { getErrorMessage } from '../services/errors';
import { validateName, validatePhone } from '../utils/validators';

const PICKER_OPTIONS = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 };

export default function useEditProfile({ onSaved } = {}) {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [neighborhood, setNeighborhood] = useState(user.neighborhood);
  const [phone, setPhone] = useState(user.phone);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // La foto se sube apenas se elige (en el mock se guarda la URI local).
  const savePhoto = async (result) => {
    if (result.canceled) return;
    setUploading(true);
    setFormError('');
    try {
      setUser(await uploadPhoto(result.assets[0].uri));
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setUploading(false);
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

  const onSave = async () => {
    const next = { name: validateName(name), phone: validatePhone(phone) };
    setErrors(next);
    setFormError('');
    if (next.name || next.phone) return;

    setSaving(true);
    try {
      setUser(await updateMe({ name, neighborhood, phone }));
      onSaved?.();
    } catch (e) {
      setFormError(getErrorMessage(e));
      setSaving(false);
    }
  };

  return {
    user,
    name, setName,
    neighborhood, setNeighborhood,
    phone, setPhone,
    errors, formError, saving, uploading,
    pickFromGallery, takePhoto, onSave,
  };
}
