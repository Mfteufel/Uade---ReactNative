import { Alert, Platform, ToastAndroid } from 'react-native';

// Aviso corto que se cierra solo. ToastAndroid viene con React Native; en iOS no existe y se usa un Alert.
export function showOfflineToast(message = 'Dispositivo sin conexión, esta acción necesita conexión.') {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert('Sin conexión', message);
}
