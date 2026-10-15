import { useState } from 'react';
import { Alert, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { updateMe, uploadPhoto } from '../../api/userApi';
import { getErrorMessage } from '../../api/errors';
import { validateName, validatePhone } from '../../utils/validators';
import { colors, spacing } from '../../constants/theme';

const PICKER_OPTIONS = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 };

export default function EditProfileScreen({ navigation }) {
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

  const onChangePhoto = () =>
    Alert.alert('Foto de perfil', 'Elegí de dónde sacar la foto', [
      { text: 'Galería', onPress: pickFromGallery },
      { text: 'Cámara', onPress: takePhoto },
      { text: 'Cancelar', style: 'cancel' },
    ]);

  const onSave = async () => {
    const next = { name: validateName(name), phone: validatePhone(phone) };
    setErrors(next);
    setFormError('');
    if (next.name || next.phone) return;

    setSaving(true);
    try {
      setUser(await updateMe({ name, neighborhood, phone }));
      navigation.goBack();
    } catch (e) {
      setFormError(getErrorMessage(e));
      setSaving(false);
    }
  };

  return (
    <FormScreen error={formError}>
      <View style={styles.photo}>
        <Avatar uri={user.photoUri} name={user.name} size={110} />
        {uploading ? <ActivityIndicator style={styles.spinner} /> : null}
        <Pressable onPress={onChangePhoto} disabled={uploading}>
          <Text style={styles.photoLink}>Cambiar foto</Text>
        </Pressable>
      </View>

      <Input label="Nombre" value={name} onChangeText={setName} error={errors.name} />
      <Input label="Barrio" value={neighborhood} onChangeText={setNeighborhood} placeholder="Ej: Palermo" />
      <Input
        label="Teléfono de contacto"
        value={phone}
        onChangeText={setPhone}
        error={errors.phone}
        keyboardType="phone-pad"
        placeholder="+54 11 5555-0000"
      />
      <Button title="Guardar cambios" onPress={onSave} loading={saving} disabled={uploading} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: 'center', marginBottom: spacing.lg },
  spinner: { position: 'absolute', top: 40 },
  photoLink: { color: colors.primary, fontWeight: '600', marginTop: spacing.sm },
});
