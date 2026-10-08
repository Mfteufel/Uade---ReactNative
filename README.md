# Hallado — objetos y mascotas perdidas

App móvil de la materia Desarrollo de Aplicaciones (UADE), hecha con React Native + Expo (JavaScript).

Esta etapa incluye **Autenticación** y **Perfil y reputación**. Todavía no hay backend:
la app usa una **API simulada (mock)** que se reemplaza fácil por la API REST real.

## Integrantes
- Marco Federico Teufel
- Walter Berrutto
- Lucas Villarreal
- Damian Dennin
- Elliff Juan Cruz

## Tecnologías
- React Native + Expo (SDK 57), JavaScript
- React Navigation (native-stack)
- AsyncStorage (datos del mock), expo-secure-store (refresh token)
- expo-local-authentication (huella / rostro), expo-image-picker (foto de perfil)

## Cómo correrla en Android

Requisitos: Node.js 20+ (con npm).

```bash
npm install
npm start
```

Después, elegí una opción:

**Celular con Expo Go**
1. Instalá "Expo Go" desde Play Store.
2. Conectá el celular a la misma wifi que la PC.
3. Escaneá el QR que muestra la terminal.
4. Si no conecta: `npx expo start --tunnel`.

**Emulador Android**
1. Abrí un emulador desde Android Studio.
2. Con Expo corriendo, apretá `a` en la terminal (o `npm run android`).
3. Necesita `ANDROID_HOME` configurado.

Atajos en la terminal de Expo: `r` recarga, `a` abre en Android, `Ctrl+C` corta.

## Probar la app (modo mock)

Usuarios de ejemplo (contraseña de todos: `hallado123`):

| Email | Qué tiene |
|---|---|
| lucia@hallado.com | 12 devoluciones, 4 insignias |
| martin@hallado.com | 5 devoluciones ("Vecino solidario") |
| carlos@hallado.com | 2 devoluciones, valoraciones negativas |
| sofia@hallado.com | cuenta nueva, sin reputación |

- **Código OTP**: no se envía email. Aparece en un Alert y en la consola. Vence a los 10 min y permite 5 intentos.
- **Reenviar código**: botón con contador de 60 s.
- **Biometría**: Configuración → switch. Necesita una huella o rostro cargados en el dispositivo.
- **Perfiles públicos**: al final de "Mi perfil" hay una lista de usuarios de ejemplo.
- **Reiniciar datos del mock**: borrar los datos de Expo Go (Ajustes de Android → Apps → Expo Go → Almacenamiento) o reinstalarlo.

## Estructura

```
App.js
src/
  config.js          USE_MOCK, API_URL, timeout
  api/
    client.js        cliente HTTP con timeout (reintentos solo en GET)
    authApi.js       funciones de /auth/*
    userApi.js       funciones de /users/*
    errors.js        ApiError { status, message }
    tokenStore.js    access token en memoria
    mock/            API simulada (borrar cuando exista el back)
  context/           AuthContext (sesión, biometría)
  navigation/        AppNavigator
  screens/           auth/, profile/, settings/
  components/        Button, Input, Avatar, ReputationCard, BadgeList...
  constants/         theme, badges, sampleUsers
  hooks/             useCountdown
  utils/             validators, biometrics, canShowPhone, memberSince
```

Las pantallas **nunca** tocan datos directamente: siempre llaman a funciones de `src/api/`.

## Pasar del mock a la API real

1. Implementar los endpoints de [`API_CONTRACT.md`](API_CONTRACT.md).
2. En `src/config.js`: `USE_MOCK = false` y `API_URL` con la URL del back.
   - Emulador Android: `http://10.0.2.2:3000`.
   - Celular físico: la IP de la PC en la red (ej. `http://192.168.1.15:3000`).
3. Borrar `src/api/mock/` y `src/constants/sampleUsers.js`.

## Reputación e insignias

- `puntos = devoluciones×10 + valoraciones positivas×2 − valoraciones negativas×5` (mínimo 0).
- Las insignias se definen en `src/constants/badges.js`. Para agregar una, sumá un objeto al array
  con su `metric` y `goal`; se muestran solas al cumplir la meta.
- `canShowPhone(user, claim)` (`src/utils/canShowPhone.js`) queda lista para cuando existan los reclamos.
