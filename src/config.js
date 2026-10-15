// Por defecto la app usa el mock. Para probar contra el backend real:
//   EXPO_PUBLIC_USE_MOCK=false EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start
export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK !== 'false';
// 10.0.2.2 = localhost del PC desde el emulador Android
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';
export const REQUEST_TIMEOUT_MS = 10000;
