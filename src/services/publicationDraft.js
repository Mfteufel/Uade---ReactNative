import AsyncStorage from '@react-native-async-storage/async-storage';

// Borrador de "Publicar": vive solo en el celular. Va en AsyncStorage (no en SecureStore)
// porque no tiene datos de sesión y puede superar los 2 KB. Uno por usuario.
const keyFor = (userId) => `hallado_borrador_publicacion_${userId}`;

export async function loadDraft(userId) {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  return raw ? JSON.parse(raw) : null;
}

export const saveDraft = (userId, draft) => AsyncStorage.setItem(keyFor(userId), JSON.stringify(draft));

export const clearDraft = (userId) => AsyncStorage.removeItem(keyFor(userId));
