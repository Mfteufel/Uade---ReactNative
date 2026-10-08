import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { updateMe } from '../../api/userApi';
import { getErrorMessage } from '../../api/errors';
import { getBiometricStatus } from '../../utils/biometrics';
import { colors, spacing } from '../../constants/theme';

export default function SettingsScreen() {
  const { user, setUser, biometricEnabled, setBiometricEnabled, logout } = useAuth();
  const [status, setStatus] = useState(null); // null = cargando
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    getBiometricStatus().then(setStatus);
  }, []);

  const onToggle = async (value) => {
    setSaving(true);
    setError('');
    const message = await setBiometricEnabled(value);
    if (message) setError(message);
    setSaving(false);
  };

  const onPhonePrivacy = async (visible) => {
    if (visible === user.phoneVisibleOnClaim) return;
    setSavingPhone(true);
    setPhoneError('');
    try {
      setUser(await updateMe({ phoneVisibleOnClaim: visible }));
    } catch (e) {
      setPhoneError(getErrorMessage(e));
    } finally {
      setSavingPhone(false);
    }
  };

  const privacyOptions = [
    { visible: true, label: 'Mostrar mi teléfono cuando se acepte un reclamo' },
    { visible: false, label: 'Comunicarme solo por la app' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.section}>Privacidad del teléfono</Text>
      {privacyOptions.map((opt) => {
        const selected = user.phoneVisibleOnClaim === opt.visible;
        return (
          <Pressable key={opt.label} style={styles.option} onPress={() => onPhonePrivacy(opt.visible)} disabled={savingPhone}>
            <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
            <Text style={styles.optionLabel}>{opt.label}</Text>
          </Pressable>
        );
      })}
      {savingPhone ? <ActivityIndicator style={styles.phoneSpinner} /> : null}
      {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}

      <Text style={[styles.section, styles.sectionGap]}>Seguridad</Text>
      {status === null ? (
        <ActivityIndicator />
      ) : (
        <>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Desbloqueo con huella o rostro</Text>
              <Text style={styles.hint}>Al abrir la app te pedimos tu huella en lugar de la contraseña.</Text>
            </View>
            {saving ? (
              <ActivityIndicator />
            ) : (
              <Switch
                value={biometricEnabled}
                onValueChange={onToggle}
                disabled={!status.available}
                trackColor={{ true: colors.primary }}
              />
            )}
          </View>
          {!status.available ? <Text style={styles.hint}>{status.message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      )}

      <View style={styles.logout}>
        <Button title="Cerrar sesión" onPress={logout} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  rowText: { flex: 1, paddingRight: spacing.md },
  label: { fontSize: 16, color: colors.text, fontWeight: '500' },
  hint: { color: colors.muted, fontSize: 13, marginTop: 2 },
  error: { color: colors.error, marginTop: spacing.sm },
  logout: { marginTop: spacing.xl },
  sectionGap: { marginTop: spacing.xl },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  optionLabel: { flex: 1, fontSize: 16, color: colors.text },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, marginRight: spacing.md, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  phoneSpinner: { alignSelf: 'flex-start', marginTop: spacing.xs },
});
