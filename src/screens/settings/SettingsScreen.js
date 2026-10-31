import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import Banner from '../../components/Banner';
import BottomActionBar from '../../components/BottomActionBar';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormScreen from '../../components/FormScreen';
import SectionTitle from '../../components/SectionTitle';
import { useAuth } from '../../context/AuthContext';
import { usePendingPublications } from '../../context/PendingPublicationsContext';
import useSettings from '../../hooks/useSettings';
import { colors, spacing, typography } from '../../constants/theme';
import appJson from '../../../app.json';

export default function SettingsScreen() {
  const {
    user, biometricEnabled, status, saving, error, onToggle,
    phoneError, savingPhone, onPhonePrivacy,
  } = useSettings();
  // La confirmación pasa a ConfirmDialog: se llama directo al cierre de sesión de AuthContext
  // (el del hook mostraría además su propio Alert cuando hay publicaciones pendientes).
  const { logout } = useAuth();
  const { pending } = usePendingPublications();
  const [confirmVisible, setConfirmVisible] = useState(false);

  const privacyOptions = [
    { visible: true, label: 'Mostrar mi teléfono cuando se acepte un reclamo' },
    { visible: false, label: 'Comunicarme solo por la app' },
  ];

  // Si hay publicaciones pendientes de envío se avisa que se van a borrar (mismo texto de siempre).
  const count = pending.length === 1 ? 'una publicación pendiente' : `${pending.length} publicaciones pendientes`;
  const logoutMessage = pending.length > 0
    ? `Tenés ${count} de envío. Si cerrás sesión se van a borrar.`
    : 'Vas a tener que volver a entrar con tu email y contraseña. Tus publicaciones y reclamos no se borran.';

  const footer = (
    <BottomActionBar>
      <Button title="Cerrar sesión" variant="dangerOutline" onPress={() => setConfirmVisible(true)} accessibilityLabel="Cerrar sesión" />
    </BottomActionBar>
  );

  return (
    <>
      <FormScreen footer={footer}>
        <SectionTitle title="Privacidad del teléfono" style={styles.firstSection} />
        <Card>
          <View style={styles.options}>
            {privacyOptions.map((opt) => (
              <Chip
                key={opt.label}
                label={opt.label}
                selected={user.phoneVisibleOnClaim === opt.visible}
                onPress={() => onPhonePrivacy(opt.visible)}
                disabled={savingPhone}
                accessibilityLabel={opt.label}
              />
            ))}
          </View>
          <Text style={styles.hint}>Sólo cuando se acepta un reclamo, y sólo a esa persona.</Text>
          {savingPhone ? <ActivityIndicator style={styles.phoneSpinner} accessibilityLabel="Guardando" /> : null}
        </Card>
        {phoneError ? <Banner kind="warn" message={phoneError} style={styles.banner} /> : null}

        <SectionTitle title="Seguridad" style={styles.section} />
        {status === null ? (
          <ActivityIndicator accessibilityLabel="Cargando" />
        ) : (
          <>
            <Card>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.label}>Desbloqueo con huella o rostro</Text>
                  <Text style={styles.hint}>Al abrir la app te pedimos tu huella en lugar de la contraseña.</Text>
                </View>
                {saving ? (
                  <ActivityIndicator accessibilityLabel="Guardando" />
                ) : (
                  <Switch
                    value={biometricEnabled}
                    onValueChange={onToggle}
                    disabled={!status.available}
                    trackColor={{ true: colors.primary }}
                    accessibilityLabel="Desbloqueo con huella o rostro"
                    accessibilityState={{ checked: biometricEnabled, disabled: !status.available }}
                  />
                )}
              </View>
              {!status.available ? <Text style={styles.hint}>{status.message}</Text> : null}
            </Card>
            {error ? <Banner kind="warn" message={error} style={styles.banner} /> : null}
          </>
        )}

        <Text style={styles.version}>Versión {appJson.expo.version}</Text>
      </FormScreen>

      <ConfirmDialog
        visible={confirmVisible}
        title="¿Cerrar sesión?"
        message={logoutMessage}
        confirmLabel="Cerrar sesión"
        danger
        onConfirm={() => {
          setConfirmVisible(false);
          logout();
        }}
        onCancel={() => setConfirmVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  firstSection: { marginTop: 0 },
  section: { marginTop: spacing.lg },
  options: { alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowText: { flex: 1, paddingRight: spacing.md },
  label: { ...typography.body, color: colors.text, fontWeight: '500' },
  hint: { ...typography.meta, color: colors.textDim, marginTop: 2 },
  banner: { marginTop: spacing.sm },
  phoneSpinner: { alignSelf: 'flex-start', marginTop: spacing.xs },
  version: { ...typography.meta, color: colors.textDim, textAlign: 'center', marginTop: spacing.xl },
});
