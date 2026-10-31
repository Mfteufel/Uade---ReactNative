import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Avatar from '../../components/Avatar';
import BottomActionBar from '../../components/BottomActionBar';
import Button from '../../components/Button';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import ListRow from '../../components/ListRow';
import Sheet from '../../components/Sheet';
import useEditProfile from '../../hooks/useEditProfile';
import { colors, spacing } from '../../constants/theme';

// Editar perfil: Nombre, Barrio (texto libre, C15) y Teléfono. «Mostrar mi teléfono» vive en
// Configuración (C14): acá no se duplica esa lógica.
export default function EditProfileScreen({ navigation }) {
  const {
    user, name, setName, neighborhood, setNeighborhood, phone, setPhone,
    errors, formError, saving, uploading, pickFromGallery, takePhoto, onSave,
  } = useEditProfile({ onSaved: () => navigation.goBack() });
  const [photoSheet, setPhotoSheet] = useState(false);

  // Cierra la hoja y abre el selector un instante después (para que no choquen los dos Modal).
  const choose = (pick) => {
    setPhotoSheet(false);
    setTimeout(pick, 300);
  };

  return (
    <>
      <FormScreen
        error={formError}
        footer={
          <BottomActionBar>
            <Button
              title="Guardar cambios"
              loadingTitle="Guardando…"
              onPress={onSave}
              loading={saving}
              disabled={uploading}
              disabledReason={uploading ? 'Esperá a que termine de subir la foto.' : undefined}
            />
          </BottomActionBar>
        }
      >
        <View style={styles.photo}>
          <Avatar uri={user.photoUri} name={user.name} size={96} />
          {uploading ? (
            <ActivityIndicator
              style={styles.spinner}
              color={colors.blue600}
              accessibilityLabel="Subiendo la foto"
            />
          ) : (
            <Button
              variant="link"
              title="Cambiar la foto"
              onPress={() => setPhotoSheet(true)}
              accessibilityLabel="Cambiar la foto de perfil"
            />
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
      </FormScreen>

      <Sheet visible={photoSheet} onClose={() => setPhotoSheet(false)} title="Foto de perfil">
        <ListRow icon="image" title="Galería" subtitle="Elegí de dónde sacar la foto" onPress={() => choose(pickFromGallery)} />
        <ListRow icon="camera" title="Cámara" last onPress={() => choose(takePhoto)} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: 'center', marginBottom: spacing.lg },
  spinner: { marginTop: spacing.sm, minHeight: 48 },
});
