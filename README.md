# Hallado — objetos y mascotas perdidas

App móvil de la materia Desarrollo de Aplicaciones (UADE), hecha con React Native + Expo (JavaScript).

Esta etapa incluye **Autenticación** y **Perfil y reputación**. El backend está en [`backend/`](backend/README.md)
(Express + PostgreSQL). Por defecto la app sigue usando una **API simulada (mock)**;
para probar contra el backend real, ver [Probar contra el backend real](#probar-contra-el-backend-real).

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

## Instalar la app en el celular por USB (con el ícono real)

Expo Go siempre muestra su propio ícono. Para instalar la app "Hallado" de verdad hace falta un build nativo.

Requisitos:
- Android Studio con el SDK de Android instalado (Gradle baja el NDK y CMake solo).
- **JDK 17** (con JDK 24 o 25 el build falla en la tarea CMake).

Pasos:
1. En el celular: activá "Opciones de desarrollador" y "Depuración USB".
2. Conectalo por USB, desbloquealo y aceptá el permiso de depuración.
3. Verificá que aparezca: `adb devices`.
4. Configurá las variables (Linux/macOS; ajustá las rutas a tu equipo):
   ```bash
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$JAVA_HOME/bin:$PATH:$ANDROID_HOME/platform-tools
   ```
5. Compilá e instalá (la primera vez tarda varios minutos):
   ```bash
   npx expo run:android
   ```
6. Buscá "Hallado" en el menú de apps.

Notas:
- La carpeta `android/` se genera sola y está en el `.gitignore`.
- Esta app tiene su propio almacenamiento: los usuarios creados en Expo Go no aparecen acá.
- La app instalada carga el código desde el servidor de Expo de la PC (puerto 8081). Si ese puerto está ocupado:
  ```bash
  npx expo start --port 8082
  adb reverse tcp:8081 tcp:8082
  ```
  Después reabrí la app.
- Si la app abre pero no carga ("Unable to load script"), revisá que el servidor de Expo esté corriendo.

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

## Probar contra el backend real

Pasos para Android con Expo Go por USB.

1. Levantá el backend. Ver [`backend/README.md`](backend/README.md) (base de datos, `.env`, `npm run migrate`, `npm run seed`).
   Dejá `npm start` corriendo en `backend/`.
2. Conectá el celular por USB con "Depuración USB" activada. Verificá con `adb devices`.
3. Redirigí los puertos del celular a la PC:
   ```bash
   adb reverse tcp:3000 tcp:3000
   adb reverse tcp:8081 tcp:8082
   ```
4. Iniciá Expo apuntando al backend real:
   ```bash
   EXPO_PUBLIC_USE_MOCK=false EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --port 8082 -c
   ```
5. Abrí la app en el celular.

Notas:
- Sin `EXPO_PUBLIC_USE_MOCK=false` la app usa el **mock**. Es el valor por defecto.
- El código de verificación **no aparece en pantalla**. Mirá la consola del backend (`[MAIL DEV] código ...`).
  Esto pasa mientras no haya Brevo configurado.
- Las cuentas del mock del teléfono **no existen** en el backend. Registrate de nuevo, o usá las del seed
  (`lucia@hallado.com`, `martin@hallado.com`, `carlos@hallado.com`, `sofia@hallado.com`, contraseña `hallado123`).
- Expo Go y la app nativa tienen **almacenamiento separado**. Los usuarios de una no aparecen en la otra.

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

1. El backend ya implementa los endpoints de [`API_CONTRACT.md`](API_CONTRACT.md).
2. Usar `EXPO_PUBLIC_USE_MOCK=false` y `EXPO_PUBLIC_API_URL` con la URL del back (ver [Probar contra el backend real](#probar-contra-el-backend-real)).
   - Emulador Android: `http://10.0.2.2:3000`.
   - Celular físico: la IP de la PC en la red (ej. `http://192.168.1.15:3000`).
3. Cuando el mock ya no haga falta: cambiar el valor por defecto de `USE_MOCK` en `src/config.js` a `false`.
   Recién después se puede borrar `src/api/mock/` y `src/constants/sampleUsers.js`, quitando antes los
   `import * as mock` y las ramas `USE_MOCK ? ... : ...` de `src/api/authApi.js` y `src/api/userApi.js`.
   Si se borra la carpeta sin hacer eso, la app no compila.

## Reputación e insignias

- `puntos = devoluciones×10 + valoraciones positivas×2 − valoraciones negativas×5` (mínimo 0).
- Las insignias se definen en `src/constants/badges.js`. Para agregar una, sumá un objeto al array
  con su `metric` y `goal`; se muestran solas al cumplir la meta.
- `canShowPhone(user, claim)` (`src/utils/canShowPhone.js`) queda lista para cuando existan los reclamos.
