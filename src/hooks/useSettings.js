import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usePendingPublications } from '../context/PendingPublicationsContext';
import { updateMe } from '../services/userApi';
import { getErrorMessage } from '../services/errors';
import { getBiometricStatus } from '../utils/biometrics';

export default function useSettings() {
  const { user, setUser, biometricEnabled, setBiometricEnabled, logout } = useAuth();
  const [status, setStatus] = useState(null); // null = cargando
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const { pending } = usePendingPublications();

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

  // Al cerrar sesión se borran las publicaciones pendientes de envío: si hay alguna, se avisa antes.
  const confirmLogout = () => {
    if (pending.length === 0) return logout();
    const count = pending.length === 1 ? 'una publicación pendiente' : `${pending.length} publicaciones pendientes`;
    Alert.alert('Cerrar sesión', `Tenés ${count} de envío. Si cerrás sesión se van a borrar.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: logout },
    ]);
  };

  return {
    user,
    biometricEnabled,
    logout: confirmLogout,
    status,
    saving,
    error,
    onToggle,
    phoneError,
    savingPhone,
    onPhonePrivacy,
  };
}
