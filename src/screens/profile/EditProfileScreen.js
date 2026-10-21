import { Alert, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import useEditProfile from '../../hooks/useEditProfile';
import { colors, spacing } from '../../constants/theme';

export default function EditProfileScreen({ navigation }) {
  const {
    user, name, setName, neighborhood, setNeighborhood, phone, setPhone,
    errors, formError, saving, uploading, pickFromGallery, takePhoto, onSave,
  } = useEditProfile({ onSaved: () => navigation.goBack() });

  const onChangePhoto = () =>
    Alert.alert('Foto de perfil', 'Elegí de dónde sacar la foto', [
      { text: 'Galería', onPress: pickFromGallery },
      { text: 'Cámara', onPress: takePhoto },
      { text: 'Cancelar', style: 'cancel' },
    ]);

  return (
    <FormScreen error={formError}>
      <View style={styles.photo}>
        <Avatar uri={user.photoUri} name={user.name} size={110} />
        {uploading ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : (
          <Pressable onPress={onChangePhoto}>
            <Text style={styles.photoLink}>Cambiar foto</Text>
          </Pressable>
        )}
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
  spinner: { marginTop: spacing.sm },
  photoLink: { color: colors.primary, fontWeight: '600', marginTop: spacing.sm },
});
