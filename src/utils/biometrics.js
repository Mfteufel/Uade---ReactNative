import * as LocalAuthentication from 'expo-local-authentication';

// Devuelve { available, message }. message explica por qué no está disponible.
export async function getBiometricStatus() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return { available: false, message: 'Este dispositivo no tiene huella ni reconocimiento facial.' };
  }
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) {
    return { available: false, message: 'No hay huella ni rostro configurados. Configuralos en los ajustes del teléfono.' };
  }
  return { available: true, message: '' };
}

// Pide la huella/rostro. Devuelve { success, error }; error es el código de expo
// (user_cancel, lockout, not_enrolled...) o null si salió bien.
export async function authenticate(promptMessage) {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancelar',
  });
  return { success: result.success, error: result.error ?? null };
}

// Mensaje para mostrar según el código de error. '' = no mostrar nada (el usuario canceló).
export function getBiometricErrorMessage(error) {
  switch (error) {
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
      return '';
    case 'lockout':
      return 'Demasiados intentos. Desbloqueá el teléfono con tu PIN y probá de nuevo.';
    case 'not_enrolled':
      return 'No hay huella ni rostro configurados en el teléfono. Ingresá con tu contraseña.';
    case 'not_available':
    case 'passcode_not_set':
      return 'La autenticación biométrica no está disponible en este dispositivo.';
    default:
      return 'No se pudo verificar tu identidad.';
  }
}
