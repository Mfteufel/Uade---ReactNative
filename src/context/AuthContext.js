import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as authApi from '../api/authApi';
import { setAccessToken } from '../api/tokenStore';
import { authenticate, getBiometricStatus } from '../utils/biometrics';

const AuthContext = createContext(null);
const REFRESH_KEY = 'hallado_refresh_token';
const BIOMETRIC_KEY = 'hallado_biometric_enabled';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true mientras se restaura la sesión
  const [locked, setLocked] = useState(false); // hay sesión guardada pero falta la huella
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  // Guarda la sesión que devuelve la API (login, registro o refresh).
  const startSession = useCallback(async (session) => {
    setAccessToken(session.accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken);
    setUser(session.user);
  }, []);

  const endSession = useCallback(async () => {
    setAccessToken(null);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
    setBiometricEnabledState(false);
    setLocked(false);
    setUser(null);
  }, []);

  // Al abrir la app: si hay refresh token guardado, se renueva la sesión.
  useEffect(() => {
    (async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
        const biometric = (await SecureStore.getItemAsync(BIOMETRIC_KEY)) === 'true';
        setBiometricEnabledState(biometric);
        if (refreshToken && biometric) {
          setLocked(true); // se pide la huella antes de entrar (ver unlock)
        } else if (refreshToken) {
          await startSession(await authApi.refreshSession(refreshToken));
        }
      } catch {
        await endSession();
      } finally {
        setLoading(false);
      }
    })();
  }, [startSession, endSession]);

  const login = async (email, password) => startSession(await authApi.login(email, password));

  // Pide la huella y, si es correcta, entra con el refresh token guardado.
  const unlock = async () => {
    if (!(await authenticate('Desbloqueá Hallado'))) return false;
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
      await startSession(await authApi.refreshSession(refreshToken));
      setLocked(false);
      return true;
    } catch {
      await endSession(); // el refresh token ya no sirve: hay que loguearse de nuevo
      return false;
    }
  };

  // Activa/desactiva la biometría. Devuelve '' si salió bien, o un mensaje de error.
  const setBiometricEnabled = async (enabled) => {
    if (enabled) {
      const status = await getBiometricStatus();
      if (!status.available) return status.message;
      if (!(await authenticate('Confirmá para activar el desbloqueo biométrico'))) {
        return 'No se pudo verificar tu identidad.';
      }
    }
    await SecureStore.setItemAsync(BIOMETRIC_KEY, String(enabled));
    setBiometricEnabledState(enabled);
    return '';
  };

  const value = {
    user, setUser, loading, locked, isLoggedIn: !!user,
    login, startSession, logout: endSession,
    biometricEnabled, setBiometricEnabled, unlock,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
