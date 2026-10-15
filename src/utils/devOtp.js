import { Alert } from 'react-native';
import { USE_MOCK } from '../config';

// Solo en modo mock: como no hay email real, mostramos el código en pantalla.
export function showDevOtp(response) {
  if (USE_MOCK && response?.devCode) {
    Alert.alert('Código de verificación', `Modo mock (sin email real).\n\nTu código es: ${response.devCode}`);
  }
}
