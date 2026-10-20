import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
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

  return {
    user,
    biometricEnabled,
    logout,
    status,
    saving,
    error,
    onToggle,
    phoneError,
    savingPhone,
    onPhonePrivacy,
  };
}
