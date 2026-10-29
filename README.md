# Hallado — objetos y mascotas perdidas

App móvil de la materia Desarrollo de Aplicaciones (UADE) para publicar y buscar objetos y mascotas perdidas o encontradas, y reclamarlas con una verificación previa. Está hecha con React Native + Expo (JavaScript) y tiene un backend propio en [`backend/`](backend/README.md) (Express + PostgreSQL).

Este README explica cómo **levantar todo y probarlo en un celular Android físico con Expo Go**. Al final hay secciones sobre el modo mock y el build nativo.

## Contenido

- [Integrantes](#integrantes)
- [Tecnologías](#tecnologías)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Cómo probar la entrega](#cómo-probar-la-entrega)
- [Correo y códigos OTP](#correo-y-códigos-otp)
- [Usuarios de prueba](#usuarios-de-prueba)
- [Qué probar](#qué-probar)
- [Estado de la entrega](#estado-de-la-entrega)
- [Qué no hace el modo Neon](#qué-no-hace-el-modo-neon)
- [Problemas típicos](#problemas-típicos)
- [Alternativa: base local sin Neon](#alternativa-base-local-sin-neon)
- [Comandos disponibles](#comandos-disponibles)
- [Modo mock](#modo-mock)
- [Build nativo (opcional)](#build-nativo-opcional)
- [Reputación e insignias](#reputación-e-insignias)

## Integrantes

- Marco Federico Teufel
- Walter Berrutto
- Lucas Villarreal
- Damian Dennin
- Elliff Juan Cruz

## Tecnologías

- Expo SDK 58, React Native 0.88, React 19, JavaScript.
- React Navigation (native-stack).
- Axios para el cliente HTTP, AsyncStorage (datos del mock) y expo-secure-store (refresh token).
- expo-local-authentication (huella o rostro), expo-image-picker, expo-image-manipulator y expo-location.
- Backend: Node.js, Express 5, PostgreSQL (`pg`), JWT, bcryptjs, nodemailer y sharp.

## Estructura del proyecto

```
App.js
app.json
package.json            scripts npm de la raíz (base, lanzador, tests)
scripts/local/          lanzador y utilidades de base (db:preparar, dev:todo, etc.)
src/
  config/index.js       USE_MOCK, API_URL, timeout
  services/             api.js (cliente Axios), authApi, userApi, claimsApi,
                        catalogApi, searchApi, errors, tokenStore y mock/ (API simulada)
  context/              AuthContext (sesión, biometría)
  navigation/           AppNavigator
  screens/              auth/, profile/, settings/, claims/, search/
  hooks/                lógica de cada pantalla
  components/           Button, Input, Avatar, ClaimCard, PublicationCard, etc.
  constants/            theme, badges, claims, search, sampleUsers
  utils/                validators, biometrics, formatos, jwt, devOtp
backend/
  src/routes/           auth, users, photos, neighborhoods, categories,
                        search, recentSearches, claims, publications, follows
  src/services/         lógica de negocio (sesión, OTP, mail, reputación, reclamos, etc.)
  src/middleware/       auth, errores, rate limit, upload
  migrations/           001 a 009 (SQL) y rollback/
  scripts/              migrate.js, seed.js, seed_demo.js
  test/                 tests unitarios y de integración
API_CONTRACT.md         contrato de la API
```

Las pantallas nunca tocan datos directamente: siempre llaman a funciones de `src/services/`. Cada función decide si usa el mock o el backend real según [`src/config/index.js`](src/config/index.js).

## Cómo probar la entrega

Con estos pasos se levanta el backend y la app en tu PC, conectados a la base de datos de la entrega (en Neon), y se prueba en un **celular Android físico con Expo Go**.

### Requisitos

- Node.js 20 o 22, con npm.
- Git.
- La PC con conexión a internet. No hace falta instalar Postgres.
- **Expo Go compatible con SDK 58** instalado en el celular (Play Store). Una versión de otro SDK no abre el proyecto.
- El celular y la PC en la **misma red Wi-Fi**, o el celular conectado por **cable USB** con la depuración USB activada y `adb` (Android platform-tools) instalado.

### 1. Instalar dependencias

```bash
git clone <URL del repositorio>
cd <carpeta del repositorio>
npm install
cd backend && npm install && cd ..
```

### 2. Archivos privados

Los autores te pasan **en privado** dos archivos. Copialos dentro de `backend/` con estos nombres exactos:

- `backend/.env.demo.neon.local`: la conexión a la base de la entrega.
- `backend/.env.demo.local`: el secreto de sesión y las credenciales del correo para recibir los códigos OTP por mail.

No los subas al repositorio ni los compartas (git los ignora).

### 3. Levantar backend y app

Por Wi-Fi (misma red):

```bash
npm run dev:neon
```

Por cable USB:

```bash
npm run dev:usb-neon
```

Cada comando levanta el backend (puerto 3000) y Expo (puerto 8082) en la misma terminal. Los logs del backend salen con el prefijo `[api]`. Antes de arrancar, el lanzador muestra el host de la base y pide confirmación: escribí `si` y Enter (hace falta una terminal interactiva). Después imprime un resumen con la URL de la API, la URL de Expo Go y el modo de correo.

### 4. Abrir la app en el celular

**Con `dev:neon` (Wi-Fi):**

1. Abrí Expo Go en el celular.
2. Si el QR de la terminal conecta, escanealo con Expo Go. Si no, elegí "Enter URL manually" y abrí `exp://<IP de tu PC>:8082` (la IP se muestra en el resumen del lanzador).
3. Si el lanzador detecta varias IP, usa la primera de la lista. Para elegir otra: `npm run dev:neon -- --ip=192.168.1.15`.

**Con `dev:usb-neon` (cable):**

1. Conectá el celular, desbloquealo y aceptá el cartel de autorización de depuración USB. Verificá con `adb devices` que figure como `device`.
2. El lanzador ejecuta `adb reverse` de los puertos 3000 y 8082 por vos.
3. En Expo Go ingresá a mano `exp://localhost:8082` (o escaneá el QR).

Para cortar todo, `Ctrl+C` en la terminal (apaga backend y Expo juntos).

Opciones del lanzador (se pasan después de `--`): `--ip=<IP>`, `--api-port=<n>`, `--expo-port=<n>`, `--solo-mostrar` (muestra la configuración sin arrancar nada) y `--logs-separados`.

### Verificar que el backend responde

Desde el navegador del celular (o de la PC) abrí `http://<IP de tu PC>:3000/health`. Tiene que mostrar `{"status":"ok"}`.

## Correo y códigos OTP

El código de verificación (OTP) se pide en dos casos: **registro de una cuenta nueva** y **recuperar contraseña**. El inicio de sesión no pide OTP.

- **Con credenciales de correo** (las variables de correo de `backend/.env.demo.local`, que los autores entregan en privado y nunca van al repositorio): el registro envía un mail real con el código a la casilla de quien se registra. El lanzador muestra `Correo : mail (SMTP)` (o `mail (Brevo)`).
- **Sin credenciales**: el código se imprime en la terminal del backend, en una línea como `[api] [MAIL DEV] código register para <email>: <código>`. El lanzador muestra `Correo : consola` y avisa que hay que completar las variables de correo en `backend/.env.demo.local` para recibirlos por mail. Es el respaldo automático.
- La app **no muestra** el código en pantalla cuando usa el backend real.
- Para probar el envío real hay que **registrarse con un email real**: los emails de los usuarios de ejemplo (`@hallado.com`) no son buzones y no reciben nada.
- El código vence a los 10 minutos y permite 5 intentos. El botón de reenviar tiene un contador de 60 segundos.
- Si al pedir el código aparece un error 502, las credenciales del correo están mal, fueron revocadas o la red bloquea el puerto de salida (465). Es común en algunas redes (ver [Problemas típicos](#problemas-típicos)). Para salir del paso, dejá vacías `SMTP_USER` y `SMTP_PASS` en `backend/.env.demo.local` y reiniciá: los códigos pasan a la consola.

## Usuarios de prueba

Todos usan la contraseña **`hallado123`** y entran directo con email y contraseña, **sin OTP**.

| Email | Qué tiene |
|---|---|
| lucia@hallado.com | 12 devoluciones, 4 insignias |
| martin@hallado.com | 5 devoluciones ("Vecino solidario") |
| carlos@hallado.com | 2 devoluciones, valoraciones negativas |
| sofia@hallado.com | cuenta nueva, sin reputación |
| ana.seed@hallado.com | publicó un hallazgo (llaves) y una pérdida (billetera) |
| bruno.seed@hallado.com | publicó una pérdida (celular) ya resuelta; Carla le devolvió el celular |
| carla.seed@hallado.com | publicó un hallazgo (DNI) con reclamos de Diego; tiene un reclamo aceptado sobre la publicación de Bruno |
| diego.seed@hallado.com | tiene un reclamo pendiente sobre el DNI de Carla (y uno anterior rechazado); publicó una pérdida (perro) |
| eva.seed@hallado.com | publicó un hallazgo (campera) y una pérdida vencida (bufanda) |

Notas:

- "Olvidé mi contraseña" con estas cuentas **no manda mail**, porque los emails `@hallado.com` no son buzones reales.
- Los usuarios creados desde la app (registro) quedan guardados en la base de la entrega (o en tu base local, si usás la alternativa).
- Los datos de ejemplo se siembran con fechas relativas al día en que se cargaron (en la base local, el día en que corriste `db:preparar`).

## Qué probar

Todo lo siguiente existe hoy en la rama principal.

**1. Autenticación**
- Registro en 3 pasos: email, código OTP y contraseña. Ver [Correo y códigos OTP](#correo-y-códigos-otp).
- Inicio de sesión con un usuario de prueba, cierre de sesión, y "Recuperar contraseña" con un email real registrado por vos.
- Biometría: Configuración, activar el switch (necesita una huella o rostro cargados en el celular). Al volver a abrir la app se pide el desbloqueo.

**2. Perfil y reputación**
- "Mi perfil": reputación, puntos, insignias e historial de valoraciones.
- "Editar perfil": nombre, barrio, teléfono (y si se muestra al aceptar un reclamo) y foto de perfil.
- Perfiles públicos de otros usuarios.
- Configuración.

**3. Búsqueda (buscador)**
- Pantalla principal con filtros: tipo (perdido o encontrado), categoría, barrio, palabras clave, fecha o período ("hoy", "últimos 3 días"), ubicación y radio.
- Resultados con las publicaciones de ejemplo y búsquedas recientes.
- Las búsquedas por fecha dependen de que los datos de ejemplo sean recientes (ver [Problemas típicos](#problemas-típicos)).

**4. Detalle de una publicación**
- Desde los resultados, tocar una publicación: fotos, datos, estado, barrio y publicador (con acceso a su perfil público).
- Con una cuenta que no sea la del publicador: "Es mío" (en hallazgos) o "Lo encontré" (en pérdidas) abre el formulario de reclamo, y "Seguir publicación" / "Dejar de seguir".
- Con la cuenta del publicador: el botón lleva a "Mis publicaciones". La dirección exacta solo la ven el publicador y quien tiene un reclamo aceptado.

**7. Reclamos**
- "Mis reclamos" (desde la pantalla principal o desde "Mi perfil"): lista y detalle de reclamos.
- Con `diego.seed@hallado.com`: reclamo pendiente sobre la publicación de Carla (con tiempo restante para que el publicador responda) y un reclamo anterior rechazado.
- Con `carla.seed@hallado.com`: reclamo aceptado sobre la publicación de Bruno, y el reclamo pendiente de Diego recibido.
- Probá rechazar el reclamo pendiente desde la cuenta de Carla. Aceptarlo responde 409: en los datos de ejemplo su publicación ya figura "en reclamo" y solo se acepta un reclamo sobre una publicación abierta.

**8. Punto de encuentro**
- Con `carla.seed@hallado.com` o `bruno.seed@hallado.com`: "Mis reclamos", el reclamo aceptado sobre la publicación de Bruno, "Coordinar punto de encuentro". Muestra el lugar ya acordado ("Estación Primera Junta") y el botón "Cómo llegar", que abre Google Maps (o la app de mapas) con esa dirección como destino.
- Proponer, aceptar o sugerir otro lugar necesita un reclamo aceptado que todavía no tenga lugar vigente, y los datos de ejemplo no traen uno. El reclamo pendiente de Diego tampoco sirve: en los datos de ejemplo su publicación ya figura "en reclamo", así que aceptarlo responde 409. Para probar ese flujo, creá un reclamo desde el detalle de una publicación (con una cuenta que no sea la del publicador, botón "Es mío" o "Lo encontré") y pedile al publicador que lo acepte desde "Mis reclamos"; el punto de encuentro se coordina desde el reclamo aceptado (ver [`API_CONTRACT.md`](API_CONTRACT.md), secciones "Reclamos" y "Punto de encuentro").
- Quien tiene el objeto propone primero: el publicador si la publicación es de algo encontrado, o quien reclamó "Lo encontré" si es de algo perdido. La otra parte acepta el lugar o sugiere otro.
- Solo coordina el lugar. Confirmar la devolución y las valoraciones todavía no están.

## Estado de la entrega

Esto **todavía no está disponible** en la app (el backend tiene el esquema de base, pero faltan rutas y pantallas):

- Modo sin conexión.
- Alertas y publicaciones seguidas: el botón seguir / dejar de seguir ya funciona desde el detalle de la publicación (`POST` y `DELETE /seguidas`), pero las secciones "Mis alertas" y "Seguidas" (listados y novedades) todavía no existen.
- Historial y valoraciones.

## Qué no hace el modo Neon

- **No siembra datos ni corre tests de integración**: está bloqueado a propósito para no tocar la base compartida. `npm run db:preparar` y `npm run test:backend` se niegan con `--neon`.
- `npm run test:backend` es **solo para la base local** (ver [Alternativa](#alternativa-base-local-sin-neon)).
- Los tests unitarios del backend pasan **sin base de datos**: `cd backend && npm test`.
- Si los datos de ejemplo quedaron viejos (las búsquedas por fecha vuelven vacías o el reclamo pendiente venció), los autores los refrescan con `npm run db:refrescar-fechas -- --neon`. Las migraciones nuevas se aplican con `npm run db:migrar-neon`. Ambos comandos piden confirmar el host y son para el equipo.

## Problemas típicos

| Síntoma | Qué hacer |
|---|---|
| La primera respuesta tarda o aparece un 503 al arrancar | Neon "despierta" la base en unos segundos. Esperá y reintentá. |
| El QR no abre el proyecto | En Expo Go, ingresá `exp://<IP de tu PC>:8082` a mano. |
| El celular no llega a la PC | Revisá el firewall: en Windows permití Node en redes privadas o abrí los puertos TCP 3000 y 8082; en Linux, `sudo ufw allow 3000/tcp` y `sudo ufw allow 8082/tcp`; en macOS, aceptá el aviso de conexiones entrantes. |
| La IP detectada no es la correcta (VPN, máquinas virtuales, WSL) | Forzala: `npm run dev:neon -- --ip=<IP>`. |
| La red del celular aísla a los dispositivos (redes públicas o de invitados) | Usá `npm run dev:usb-neon`. |
| "Network Error" en la app | Abrí `http://<IP>:3000/health` desde el navegador del celular. Si no responde, es red o firewall. |
| Puerto 3000 u 8082 ocupado | Cerrá lo que lo usa, o usá `--api-port=<n>` y `--expo-port=<n>`. |
| `dev:usb-neon` dice que no ve ningún dispositivo | Revisá el cable, la depuración USB y el cartel de autorización; confirmá con `adb devices`. |
| Error 502 al pedir el código | Credenciales de correo mal o bloqueadas. Ver [Correo y códigos OTP](#correo-y-códigos-otp). |
| Error 502 y la red es la de un instituto, trabajo o similar | Algunas redes bloquean el puerto SMTP 465. Probá con otra red (por ejemplo, datos del celular compartidos) o dejá vacías las variables de correo en `backend/.env.demo.local` y tomá el código de la consola (`[api] [MAIL DEV]`). |
| Las búsquedas por fecha ("hoy", "últimos 3 días") vuelven vacías | Los datos de ejemplo son viejos. Avisá a los autores para que los refresquen. |

## Alternativa: base local sin Neon

Si no tenés los archivos privados, podés usar un Postgres (versión 13 o superior) instalado a mano en tu máquina.

1. Creá una base vacía (por ejemplo `hallado`) con un usuario que pueda crear tablas. Opcional: otra base `hallado_test` para los tests de integración.
2. Copiá [`backend/.env.local-demo.example`](backend/.env.local-demo.example) como `backend/.env.demo.local` (o corré una vez `npm run db:preparar` y lo crea solo) y ajustá `DATABASE_URL` con tu usuario, clave, puerto y base. El host tiene que ser `localhost` o `127.0.0.1`. Para recibir los códigos OTP por mail, completá las variables de correo; si quedan vacías, el código sale en la consola.
3. `npm run db:preparar`: aplica las migraciones y carga los datos de ejemplo. Se puede repetir sin problemas.
4. `npm run dev:todo` (Wi-Fi) o `npm run dev:usb` (cable), y abrí la app como en el paso 4 de [Cómo probar la entrega](#4-abrir-la-app-en-el-celular).
5. Opcional: con `TEST_DATABASE_URL` apuntando a la base de test, `npm run test:backend` corre también los tests de integración. Si está vacía, corren solo los unitarios.

## Comandos disponibles

Se corren en la raíz del proyecto.

| Comando | Qué hace |
|---|---|
| `npm run dev:neon` | Backend + Expo contra la base de la entrega (Neon), por Wi-Fi. |
| `npm run dev:usb-neon` | Lo mismo por cable USB. |
| `npm run dev:todo` | Backend + Expo con base local, por Wi-Fi. |
| `npm run dev:usb` | Backend + Expo con base local, por cable USB. |
| `npm run db:preparar` | Migra y siembra la base local (solo local). |
| `npm run db:refrescar-fechas` | Actualiza las fechas de los datos de ejemplo (agregá `-- --neon` para Neon; es para el equipo). |
| `npm run db:migrar-neon` | Aplica migraciones pendientes en Neon, con confirmación. Es para el equipo. |
| `npm run web` | Abre la app en el navegador (`expo start --web`). |
| `npm run test:backend` | Tests del backend con base local (solo local). |

Más detalle del backend (variables de entorno, esquema, migraciones, cuentas del seed) en [`backend/README.md`](backend/README.md). El contrato de la API está en [`API_CONTRACT.md`](API_CONTRACT.md).

## Modo mock

Sin backend, la app puede correr con una **API simulada** (valor por defecto cuando no se define `EXPO_PUBLIC_USE_MOCK=false`). Sirve para ver la interfaz sin base de datos.

```bash
npm start
```

Después abrí Expo Go y escaneá el QR (si no conecta: `npx expo start --tunnel`).

- Usuarios: los mismos de la tabla de [Usuarios de prueba](#usuarios-de-prueba) (`hallado123`), pero solo existen en el mock del celular, no en el backend.
- El código OTP aparece en un Alert y en la consola.
- Para reiniciar los datos del mock: borrá los datos de Expo Go (Ajustes de Android, Apps, Expo Go, Almacenamiento) o reinstalalo.
- Los lanzadores `dev:*` ya definen `EXPO_PUBLIC_USE_MOCK=false` y `EXPO_PUBLIC_API_URL`; no hace falta tocar nada a mano.

Para pasar el valor por defecto a la API real, cambiá `USE_MOCK` en `src/config/index.js`.

## Build nativo (opcional)

Expo Go siempre muestra su propio ícono. Para instalar la app "Hallado" de verdad hace falta un build nativo. No es necesario para probar la entrega.

Requisitos:
- Android Studio con el SDK de Android (Gradle baja el NDK y CMake solo).
- **JDK 17** (con JDK 24 o 25 el build falla en la tarea CMake).

Pasos:
1. En el celular: activá "Opciones de desarrollador" y "Depuración USB".
2. Conectalo por USB, desbloquealo y aceptá el permiso. Verificá con `adb devices`.
3. Configurá las variables (Linux/macOS; ajustá las rutas):
   ```bash
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$JAVA_HOME/bin:$PATH:$ANDROID_HOME/platform-tools
   ```
4. Compilá e instalá (la primera vez tarda varios minutos):
   ```bash
   npx expo run:android
   ```
5. Buscá "Hallado" en el menú de apps.

Notas:
- La carpeta `android/` se genera sola y está en el `.gitignore`.
- La app instalada tiene su propio almacenamiento: los usuarios creados en Expo Go no aparecen ahí.
- La app instalada carga el código desde el servidor de Expo de la PC (puerto 8081 por defecto). Si ese puerto está ocupado, iniciá Expo en otro puerto y redirigilo con `adb reverse`:
  ```bash
  npx expo start --port 8082
  adb reverse tcp:8081 tcp:8082
  ```
- Si la app abre pero no carga ("Unable to load script"), revisá que el servidor de Expo esté corriendo.

## Reputación e insignias

- `puntos = devoluciones×10 + valoraciones positivas×2 − valoraciones negativas×5` (mínimo 0).
- Las insignias se definen en `src/constants/badges.js`. Para agregar una, sumá un objeto al array con su `metric` y `goal`; se muestran solas al cumplir la meta.
