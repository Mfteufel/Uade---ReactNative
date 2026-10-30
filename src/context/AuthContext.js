import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as authApi from '../services/authApi';
import { getErrorMessage, getErrorStatus } from '../services/errors';
import { setupInterceptors } from '../services/api';
import { setAccessToken } from '../services/tokenStore';
import { clearDraft } from '../services/publicationDraft';
import { authenticate, getBiometricErrorMessage, getBiometricStatus } from '../utils/biometrics';

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

  // Renueva el access token (lo llama el interceptor de api.js). Devuelve true si renovó,
  // false si no hay refresh token. Si el refresh falla, relanza el error: el interceptor
  // decide (401 -> logout; red/5xx -> no cierra la sesión).
  const renewSession = useCallback(async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refreshToken) return false;
    await startSession(await authApi.refreshSession(refreshToken));
    return true;
  }, [startSession]);

  useEffect(
    () => setupInterceptors({ refresh: renewSession, logout: endSession }),
    [renewSession, endSession],
  );

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
      } catch (e) {
        // Solo un 401 invalida la sesión. Si fue red/timeout/5xx se va al login
        // sin borrar el refresh token, así el próximo arranque reintenta.
        if (getErrorStatus(e) === 401) await endSession();
      } finally {
        setLoading(false);
      }
    })();
  }, [startSession, endSession]);

  // Cierre de sesión pedido por la persona: borra su borrador de "Publicar" (trae respuesta de verificación y dirección).
  // Si falla el storage no se frena el cierre. La expiración forzada de sesión (endSession) no lo toca.
  // Todavía no existe "eliminar cuenta" en la app: cuando se agregue, tiene que pasar por acá o llamar a clearDraft igual.
  const logout = async () => {
    try {
      if (user) await clearDraft(user.id);
    } catch {
      // ignorado a propósito
    }
    await endSession();
  };

  const login = async (email, password) => startSession(await authApi.login(email, password));

  // Pide la huella y, si es correcta, entra con el refresh token guardado.
  // Devuelve { ok, message }; message es '' si el usuario solo canceló.
  const unlock = useCallback(async () => {
    const status = await getBiometricStatus();
    if (!status.available) return { ok: false, message: status.message };

    const result = await authenticate('Desbloqueá Hallado');
    if (!result.success) return { ok: false, message: getBiometricErrorMessage(result.error) };

    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refreshToken) {
      await endSession();
      return { ok: false, message: 'Tu sesión venció. Ingresá con tu contraseña.' };
    }
    try {
      await startSession(await authApi.refreshSession(refreshToken));
      setLocked(false);
      return { ok: true, message: '' };
    } catch (e) {
      if (getErrorStatus(e) === 401) {
        await endSession(); // el refresh token ya no sirve: hay que loguearse de nuevo
        return { ok: false, message: 'Tu sesión venció. Ingresá con tu contraseña.' };
      }
      // sin red, timeout o error del servidor: se queda bloqueado para reintentar
      return { ok: false, message: getErrorMessage(e) };
    }
  }, [startSession, endSession]);

  // Activa/desactiva la biometría. Devuelve '' si salió bien, o un mensaje de error.
  const setBiometricEnabled = async (enabled) => {
    if (enabled) {
      const status = await getBiometricStatus();
      if (!status.available) return status.message;
      const result = await authenticate('Confirmá para activar el desbloqueo biométrico');
      // Si falla o se cancela no se activa; el mensaje es '' cuando solo canceló.
      if (!result.success) return getBiometricErrorMessage(result.error);
    }
    await SecureStore.setItemAsync(BIOMETRIC_KEY, String(enabled));
    setBiometricEnabledState(enabled);
    return '';
  };

  const value = {
    user, setUser, loading, locked, isLoggedIn: !!user,
    login, startSession, logout,
    biometricEnabled, setBiometricEnabled, unlock,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
