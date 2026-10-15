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

// Pide la huella/rostro. Devuelve true si el usuario se autenticó.
export async function authenticate(promptMessage) {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancelar',
  });
  return result.success;
}
