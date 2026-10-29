# API Contract — Hallado

Endpoints que expone el backend (`backend/`) y que consume la app.
La app usa el backend real si `EXPO_PUBLIC_USE_MOCK=false`. Por defecto usa el mock (`src/api/mock/`).
La URL base sale de `EXPO_PUBLIC_API_URL` (ver `src/config.js`).

Ver también: [`backend/README.md`](backend/README.md) para correrlo.

## Convenciones

- **Base URL**: `EXPO_PUBLIC_API_URL`. Ejemplos:
  - USB con `adb reverse tcp:3000 tcp:3000`: `http://localhost:3000`
  - Emulador Android: `http://10.0.2.2:3000`
- **Formato**: JSON en body y respuestas. La foto va en `multipart/form-data`.
- **Body JSON**: máximo 10 KB.
- **Fechas**: ISO 8601 (`2026-09-15T12:00:00.000Z`).
- **Errores**: siempre HTTP 4xx/5xx con body `{ "message": "Texto en español" }`.
  La app muestra `message` tal cual.
- **Rutas con token**: todo `/users/*`. Mandan el header `Authorization: Bearer <accessToken>`.
- **Token vencido o inválido** en una ruta con token: `401` con `Sesión inválida. Volvé a iniciar sesión.`
- **accessToken**: JWT, vence a los **15 minutos**.
  - La app, ante un 401 en una ruta fuera de `/auth/`, renueva el token y reintenta una vez.
- **refreshToken**: vence a los **30 días**. Se **rota** en cada `POST /auth/refresh`:
  - El refresh token usado queda inválido. Devuelve un par nuevo.
  - Si se reusa uno viejo dentro de los **10 s** de la rotación, solo falla ese pedido.
  - Si se reusa uno viejo **después de 10 s**, el servidor revoca todas las sesiones del usuario.
- **Refresh**: `/auth/refresh` no usa el header `Authorization`. Ante cualquier error responde `401` con `La sesión venció. Volvé a iniciar sesión.`
- **404 de ruta inexistente**: `{ "message": "Ruta no encontrada" }`.
- **Error interno**: `500` con `Error interno del servidor`.
- **Base de datos no disponible**: `503` con `El servicio no está disponible por un momento. Probá de nuevo en unos segundos.` (incluye `Retry-After: 5`).

### Rate limit (por IP o por usuario)

Cuando se supera un límite: `429` con
`{ "message": "Demasiados intentos. Esperá unos minutos y probá de nuevo." }`
(la subida de fotos tiene su propio mensaje, ver abajo).

| Grupo | Límite | Clave |
|---|---|---|
| Todo `/auth/*` | 60 pedidos / 15 min | IP |
| `POST /auth/login` | 10 fallos / 15 min | IP |
| Pedir código (registro y recuperación) | 5 pedidos / 15 min | IP |
| `POST /auth/password/reset` | 10 fallos / 15 min | IP |
| Todo `/users/*` | 300 pedidos / 15 min | Usuario |
| `/users/*` sin token válido | 100 respuestas 401 / 15 min | IP |
| `POST /users/me/photo` | 10 subidas / hora (cuenta también las fallidas) | Usuario |
| `POST /publicaciones/fotos` | 30 subidas / hora (cuenta también las fallidas) | Usuario |
| `GET /photos/:id` | 1000 pedidos / 15 min | IP |
| Todo `/reclamos/*`, `/puntos-encuentro/*`, `/publicaciones/:id/reclamos/*` y `/barrios` | 300 pedidos / 15 min (mismo contador que `/users/*`) | Usuario |
| `/reclamos/*`, `/puntos-encuentro/*`, `/publicaciones/:id/reclamos/*` y `/barrios` sin token válido | 100 respuestas 401 / 15 min | IP |
| `POST /reclamos/foto` | 10 subidas / hora (cuenta también las fallidas) | Usuario |
| `GET /publicaciones/:id` y todo `/seguidas/*` | 300 pedidos / 15 min (mismo contador que `/users/*`) | Usuario |
| `GET /publicaciones/:id` y `/seguidas/*` sin token válido | 100 respuestas 401 / 15 min | IP |

### Códigos de error usados

| Status | Cuándo |
|---|---|
| 400 | Código OTP incorrecto o no se pidió código. Foto mal formada. JSON inválido. |
| 401 | Credenciales incorrectas, token inválido o vencido, registro vencido. |
| 403 | Reclamos: reclamar lo propio, 3 intentos agotados, aceptar/rechazar sin ser el publicador. |
| 404 | Usuario, cuenta, foto, publicación o reclamo inexistente (o reclamo ajeno). Ruta inexistente. |
| 408 | La subida de foto tardó demasiado. Timeout del cliente (lo genera la app). |
| 409 | Email ya registrado. Reclamos: publicación que ya no admite reclamos, reclamo activo, reclamo vencido o ya decidido. |
| 410 | Código OTP vencido. |
| 413 | Body JSON mayor a 10 KB. Foto mayor a 5 MB. |
| 422 | Dato inválido (email, contraseña, nombre, código con formato incorrecto, imagen no válida). |
| 429 | Rate limit. Código OTP con demasiados intentos. Reenvío antes de 60 s. Ya hay una subida en curso. |
| 500 | Error interno. |
| 502 | No se pudo enviar el mail del código. |
| 503 | Base de datos no disponible. Demasiadas subidas de foto a la vez. |

## Reglas del OTP

Aplican a registro y a recuperación de contraseña.

- **6 dígitos** numéricos.
- Vence a los **10 minutos** (`expiresInSec: 600`).
- Máximo **5 intentos fallidos**. Al 5.º el código se invalida y hay que pedir uno nuevo (429).
- Mínimo **60 s** entre envíos al mismo email (`resendInSec: 60`). Antes da 429.
- Máximo **5 códigos por hora** por email. Después da 429.
- Pedir un código nuevo **invalida el anterior**.
- Se usa **una sola vez**.
- El backend **nunca devuelve el código** ni `devCode`. El código llega por mail (Brevo).
  Si no hay Brevo configurado (desarrollo), el código sale por la **consola del servidor**: `[MAIL DEV] código ...`.

## Objetos

**Session**
```json
{
  "user": { /* User */ },
  "accessToken": "string (JWT, 15 min)",
  "refreshToken": "string (30 días, rotado en cada refresh)"
}
```

**User** (datos propios, privados)
```json
{
  "id": "u_lucia",
  "email": "lucia@hallado.com",
  "name": "Lucía Fernández",
  "photoUri": "http://localhost:3000/photos/3f2c1a9e-0b7d-4c1e-9a8f-2d6b5e7c8a90",
  "neighborhood": "Palermo",
  "phone": "+54 11 5555-0001",
  "phoneVisibleOnClaim": true,
  "createdAt": "2024-03-10T12:00:00.000Z"
}
```
- `id`: `u_` + 24 caracteres hex para cuentas nuevas. En el seed: `u_lucia`, `u_martin`, etc.
- `photoUri`: `${PUBLIC_URL}/photos/<uuid>` o `null` si no tiene foto. Viene en **todo** `User` y en el perfil público.
- Al registrarse, `name` es la parte del email antes de la `@`. `neighborhood` y `phone` empiezan vacíos (`""`).

**Reputation**
```json
{
  "points": 151,
  "completedReturns": 12,
  "positiveRatings": 18,
  "negativeRatings": 1,
  "positivePercent": 95
}
```
- `points = max(0, completedReturns*10 + positiveRatings*2 - negativeRatings*5)`
- `positivePercent = round(positiveRatings*100 / (positiveRatings + negativeRatings))`, o `null` si no hay valoraciones.
- Las insignias **no** las devuelve el back. La app las calcula con `src/constants/badges.js`.

---

## Autenticación

### POST `/auth/register/request-otp`
Paso 1 del registro. También sirve para reenviar el código.

Body: `{ "email": "nuevo@mail.com" }`

200:
```json
{ "message": "Te enviamos un código de 6 dígitos.", "expiresInSec": 600, "resendInSec": 60 }
```

Errores:
- 422 `El email no es válido.`
- 409 `Ya existe una cuenta con ese email.`
- 429 `Esperá N segundos para pedir otro código.` (antes de 60 s)
- 429 `Pediste demasiados códigos. Probá de nuevo en una hora.` (más de 5 por hora)
- 502 `No pudimos enviar el email. Probá de nuevo en unos minutos.`

### POST `/auth/register/verify-otp`
Paso 2.

Body: `{ "email": "nuevo@mail.com", "code": "123456" }`

200: `{ "registrationToken": "string" }` (JWT de 30 min para el paso 3)

Errores:
- 422 `El código tiene 6 dígitos.`
- 400 `Pedí un código primero.`
- 400 `Código incorrecto. Te quedan N intentos.` (o `Te queda 1 intento.`)
- 410 `El código venció. Pedí uno nuevo.`
- 429 `Demasiados intentos fallidos. Pedí un código nuevo.`

### POST `/auth/register/set-password`
Paso 3. Crea la cuenta e inicia sesión.

Body: `{ "registrationToken": "string", "password": "minimo8car" }`

200: `Session`

Errores:
- 401 `El registro venció. Empezá de nuevo.`
- 422 `La contraseña debe tener al menos 8 caracteres.`
- 422 `La contraseña no puede superar los 72 caracteres.`
- 409 `Ya existe una cuenta con ese email.` (si alguien se registró mientras tanto)

### POST `/auth/login`
Body: `{ "email": "lucia@hallado.com", "password": "hallado123" }`

200: `Session`

Errores:
- 401 `Email o contraseña incorrectos.` (mismo mensaje para email inexistente, clave mala o clave de más de 72 bytes)
- 429 rate limit (10 fallos por 15 min)

### POST `/auth/refresh`
Body: `{ "refreshToken": "string" }`

200: `Session` (con un refresh token **nuevo**; el anterior queda inválido)

Errores:
- 401 `La sesión venció. Volvé a iniciar sesión.` (token inválido, vencido, ya usado o revocado)

La app cierra la sesión ante este 401.

### POST `/auth/password/request-otp`
Body: `{ "email": "lucia@hallado.com" }`

200: igual que `/auth/register/request-otp`.

Errores:
- 422 `El email no es válido.`
- 404 `No existe una cuenta con ese email.`
- 429 igual que `/auth/register/request-otp`
- 502 `No pudimos enviar el email. Probá de nuevo en unos minutos.`

### POST `/auth/password/resend-otp`
Igual que el anterior. Invalida el código anterior y respeta los 60 s.

### POST `/auth/password/reset`
Verifica el código y cambia la contraseña en un solo paso.

Body: `{ "email": "...", "code": "123456", "newPassword": "minimo8car" }`

200: `{ "message": "Contraseña actualizada." }`

Efectos: **borra todas las sesiones** del usuario. No devuelve tokens. Hay que volver a hacer login.

Errores:
- 422 `El email no es válido.`, `El código tiene 6 dígitos.`, o contraseña corta/larga (mismos mensajes que registro)
- 400, 410 y 429 igual que `verify-otp`
- 404 `No existe una cuenta con ese email.`
- 429 rate limit (10 fallos por 15 min)

---

## Usuarios

Todas estas rutas requieren token. Sin token válido: 401 `Sesión inválida. Volvé a iniciar sesión.`

### GET `/users/me`
200: `User`

### PUT `/users/me`
Actualiza solo los campos enviados. Ignora cualquier otro campo (`email`, `id`, `photoUri`, etc. no se pueden cambiar acá).

Body (todos opcionales):
```json
{
  "name": "Lucía F.",
  "neighborhood": "Palermo",
  "phone": "+54 11 5555-0001",
  "phoneVisibleOnClaim": false
}
```

Validaciones:
- `name`: texto, sin espacios sobrantes, máximo **80** caracteres. Tiene que tener al menos una letra o número.
- `neighborhood`: texto, máximo **80** caracteres.
- `phone`: texto, máximo **30** caracteres.
- Los textos no pueden tener caracteres de control ni marcas de dirección de texto (bidi).
- `phoneVisibleOnClaim`: `true` o `false`.

200: `User` actualizado

Errores (422):
- `El cuerpo debe ser un objeto JSON.`
- `El nombre no puede estar vacío.`
- `El nombre debe ser texto.` (igual para `El barrio` y `El teléfono`)
- `El nombre no puede superar los 80 caracteres.` (igual para barrio: 80, teléfono: 30)
- `El nombre tiene caracteres no permitidos.` (igual para los demás campos de texto)
- `phoneVisibleOnClaim debe ser verdadero o falso.`

### POST `/users/me/photo`
Sube o reemplaza la foto de perfil.

- Body: `multipart/form-data`, campo `photo` (una sola imagen).
- Formatos: **JPEG, PNG o WEBP**.
  - No se aceptan imágenes animadas.
  - No se aceptan PNG entrelazados.
  - Máximo **25 megapíxeles**.
- Tamaño máximo del archivo: **5 MB**.
- El servidor **re-codifica** la imagen:
  - Salida: **JPEG, 512 px máximo** de lado (sin agrandar).
  - Se aplica la orientación de la cámara y se **quitan los metadatos** (EXIF, GPS).
  - Fondo blanco si tiene transparencia.
- **Una foto por usuario**. La anterior se borra.
- La app conviene que **achique la imagen a ~1024 px** antes de subirla. Así sube menos y no se pierde calidad.

200: `User` actualizado (con el `photoUri` nuevo)

Errores:
- 413 `La foto no puede superar los 5 MB.`
- 400 `La foto tiene que enviarse como multipart/form-data.`
- 400 `Mandá una sola foto en el campo "photo".`
- 400 `El formulario de la foto tiene datos de más.`
- 400 `El formulario de la foto está mal armado.`
- 422 `Elegí una foto para subir.` (falta el campo)
- 422 `La foto está vacía.`
- 422 `El archivo no es una imagen válida (JPG, PNG o WEBP).`
- 422 `La imagen es demasiado grande (máximo 25 megapíxeles).`
- 408 `La subida tardó demasiado. Probá de nuevo con mejor conexión.` (timeout de subida, 30 s por defecto)
- 429 `Ya tenés una foto subiéndose. Esperá a que termine.` (una subida simultánea por usuario)
- 429 `Subiste demasiadas fotos. Probá de nuevo en un rato.` (10 por hora por usuario)
- 503 `Hay muchas fotos subiéndose. Probá de nuevo en unos segundos.` (máximo 2 subidas en simultáneo en todo el servidor; trae `Retry-After: 5`)

### GET `/users/:id/public`
Perfil visible para otras personas. **No incluye** email, teléfono, barrio ni historial.

200:
```json
{
  "id": "u_lucia",
  "name": "Lucía Fernández",
  "photoUri": "http://localhost:3000/photos/3f2c1a9e-0b7d-4c1e-9a8f-2d6b5e7c8a90",
  "memberSince": "2024-03-10T12:00:00.000Z",
  "reputation": { /* Reputation */ }
}
```

Errores: 404 `Usuario no encontrado.` (también si el `:id` tiene formato inválido).

### GET `/users/:id/reputation`
200: `Reputation`

Errores: 404 `Usuario no encontrado.`

---

## Reclamos (punto 7)

Todas estas rutas requieren token y cuentan para el rate limit de `/users/*` (300 / 15 min por usuario).
Valores reales de la base (la app traduce las etiquetas al español):
- `type` del reclamo: `mine` ("Es mío", solo sobre una publicación `found`) o `found` ("Lo encontré", solo sobre una `lost`).
- `status`: `pending`, `accepted`, `rejected`, `expired`.

Reglas (las aplica el servidor; la app solo las muestra):
- **Máximo 3 intentos por persona y publicación.** Cuentan todos los reclamos creados, incluso rechazados o vencidos.
  Dos pedidos simultáneos se atienden de a uno (se bloquea la fila de la publicación) y los índices únicos de la base son la red de seguridad.
- **Un solo reclamo activo** (`pending` o `accepted`) por persona y publicación.
- Solo se puede reclamar una publicación `open` y no vencida, y no la propia.
- **Vencimiento a las 48 h**: `expires_at` lo fija el servidor al crear. Un reclamo `pending` pasa a `expired` con el reloj del servidor:
  antes de cada lectura o decisión y con un barrido cada 5 min (`expireDueClaims`). No depende de la app ni del teléfono.
- **Aceptar** → reclamo `accepted`, publicación `in_claim` y `status_changed_at = now()`. **Rechazar** no toca la publicación.
  En la misma transacción, los demás reclamos `pending` de esa publicación pasan a `rejected` (con `decided_at`): la publicación ya no admite otro
  reclamo aceptado, así nadie queda en "Pendiente" durante 48 h. Siguen contando como intento de quien los envió.
- Solo el publicador acepta o rechaza, y solo un reclamo `pending` que no venció.
- **Privacidad**: la respuesta de verificación correcta **nunca** sale del servidor. El publicador ve la respuesta que escribió el solicitante y
  `answerMatches` (comparación sin mayúsculas, acentos ni espacios de más); el solicitante no ve ninguna de las dos.
  El teléfono de la otra parte solo viene si el reclamo está `accepted`, esa persona dejó `phoneVisibleOnClaim` en `true` y cargó un teléfono.

**Claim** (lo que devuelven las rutas de reclamos; `GET /reclamos/:id` suma `attemptsLeft` y `maxAttempts` si quien consulta es el solicitante)
```json
{
  "id": "c_3f2c1a9e0b7d4c1e9a8f2d6b",
  "role": "claimer",
  "type": "mine",
  "status": "pending",
  "attemptNumber": 1,
  "description": "Tiene un sticker en el costado",
  "photoUri": "http://localhost:3000/photos/3f2c1a9e-0b7d-4c1e-9a8f-2d6b5e7c8a90",
  "foundNeighborhood": null,
  "createdAt": "2026-10-24T10:00:00.000Z",
  "expiresAt": "2026-10-26T10:00:00.000Z",
  "decidedAt": null,
  "publication": { "id": "p_...", "title": "Llaves con llavero", "type": "found", "status": "open" },
  "otherParty": { "id": "u_...", "name": "Ana Seed", "photoUri": null, "phone": null },
  "verificationAnswer": "rojo",
  "answerMatches": true
}
```
- `role`: `claimer` (lo envié yo) o `publisher` (lo recibí).
- `verificationAnswer` y `answerMatches` solo aparecen para el publicador y solo en reclamos `mine`.
- `foundNeighborhood`: `{ "id": "palermo", "name": "Palermo" }` en los reclamos `found`, si no `null`.
- `photoUri`: foto del reclamo o `null`. Se sirve con `GET /photos/:id` **con token** y solo a las dos partes del reclamo.

### GET `/publicaciones/:id/reclamos/formulario`
Lo que necesita el formulario antes de enviar. **Ruta mínima agregada para el punto 7** (todavía no existe el detalle de publicación del punto 4).
Nunca devuelve la respuesta de verificación ni la dirección exacta.

200:
```json
{
  "publicationId": "p_...",
  "title": "Llaves con llavero",
  "type": "found",
  "claimType": "mine",
  "verificationQuestion": "¿De qué color es el llavero?",
  "attemptsLeft": 2,
  "canClaim": true,
  "reason": null
}
```
- `verificationQuestion` solo viene si `type` es `found`; si no, `null`.
- Si `canClaim` es `false`, `reason` explica por qué (publicación propia, ya no admite reclamos, reclamo activo, 3 intentos agotados).

Errores: 404 `Publicación no encontrada.`

### POST `/reclamos/foto`
Sube la foto que acredita un reclamo. Se llama **antes** de crear el reclamo, que la referencia con `photoId`.
Mismas reglas que `POST /users/me/photo` (campo `photo`, JPEG/PNG/WEBP, 5 MB, se re-codifica a JPEG de 512 px sin metadatos,
una subida a la vez por usuario, 10 por hora). La foto queda con `kind = 'claim'`. Una foto subida y nunca usada en un reclamo queda sin referencia. El servidor borra las fotos `kind = 'claim'` que ningún reclamo usa pasadas 24 h (barrido al iniciar y cada hora); si un reclamo las referencia después, responde 422 `La foto no es válida. Subila de nuevo.`

201: `{ "photoId": "3f2c1a9e-0b7d-4c1e-9a8f-2d6b5e7c8a90" }`

Errores: los mismos que `POST /users/me/photo`.

### POST `/publicaciones/:id/reclamos`
Crea un reclamo. El body depende del tipo de la publicación.

"Es mío" (publicación `found`):
```json
{ "verificationAnswer": "rojo", "description": "opcional, máx. 280", "photoId": "uuid opcional" }
```
"Lo encontré" (publicación `lost`):
```json
{ "photoId": "uuid de POST /reclamos/foto", "foundNeighborhoodId": "palermo", "description": "opcional, máx. 280" }
```

201: `Claim` (con `role: "claimer"`)

Errores:
- 403 `No podés reclamar tu propia publicación.`
- 403 `Alcanzaste el máximo de 3 intentos para esta publicación.`
- 404 `Publicación no encontrada.`
- 409 `Esta publicación ya no admite reclamos.`
- 409 `Ya tenés un reclamo pendiente o aceptado para esta publicación.`
- 422 `La respuesta es obligatoria.` / `Tenés que adjuntar una foto del objeto.` / `Elegí el barrio donde lo encontraste.` /
  `Elegí un barrio de la lista.` / `La foto no es válida. Subila de nuevo.` / textos largos o con caracteres no permitidos.

### GET `/reclamos/enviados`
200: `Claim[]` con los reclamos que mandó el usuario (`role: "claimer"`), del más nuevo al más viejo (máximo 100).

### GET `/reclamos/recibidos`
200: `Claim[]` con los reclamos sobre publicaciones del usuario (`role: "publisher"`), del más nuevo al más viejo (máximo 100).

### GET `/reclamos/:id`
200: `Claim`. Solo para las dos partes: a cualquier otra persona le responde 404 (no revela que existe).

Errores: 404 `Reclamo no encontrado.`

### POST `/reclamos/:id/aceptar`
### POST `/reclamos/:id/rechazar`
Sin body. Solo el publicador. 200: `Claim` con el estado nuevo (respuesta real del servidor).

Errores:
- 403 `Solo quien publicó puede aceptar o rechazar un reclamo.`
- 404 `Reclamo no encontrado.` (también si no es parte del reclamo)
- 409 `Este reclamo venció: pasaron más de 48 horas sin respuesta.`
- 409 `Este reclamo ya fue aceptado.` / `Este reclamo ya fue rechazado.`
- 409 `La publicación ya no está abierta, no se puede aceptar este reclamo.` (solo al aceptar)

### GET `/barrios`
Catálogo de barrios para los formularios. **Ruta mínima agregada para "Lo encontré"**; el punto 3 (`/categorias`, `/barrios`) puede reutilizarla.

200: `[{ "id": "palermo", "name": "Palermo", "locality": "CABA" }, ...]` ordenado por localidad y nombre.

---

## Punto de encuentro (punto 8)

Rutas con token; cuentan para el rate limit de `/users/*` (300 / 15 min por usuario). Valores reales de `meeting_points.status`:
`proposed` (propuesto, espera respuesta), `accepted` (acordado) y `counter_proposed` (reemplazado por otra propuesta; solo queda en el historial).

Reglas (las aplica el servidor; la app solo las muestra):
- Solo existe para un reclamo `accepted` y solo lo ven y modifican **las dos partes** del reclamo. A cualquier otra persona le responde 404.
- **Quien tiene el objeto propone el primer lugar**: el publicador si la publicación es `found`; el solicitante si es `lost` ("Lo encontré").
- Con una propuesta `proposed`, **responde la parte que NO propuso**: la acepta o sugiere otro lugar. Quien propuso no puede aceptar su propia propuesta ni proponer de nuevo.
- Una sugerencia pasa la propuesta vigente a `counter_proposed` (con `responded_at`) e inserta la nueva con `replaces_id` apuntando a ella, en una sola transacción.
  Hay un solo punto vigente (`proposed` o `accepted`) por reclamo; el reclamo se bloquea (`FOR UPDATE`) para que dos pedidos simultáneos se atiendan de a uno.
- **Un punto `accepted` es definitivo** (decisión del equipo: el TPO solo pide aceptar o sugerir otro sobre una propuesta). No cambia el estado del reclamo ni de la publicación.
- Se guarda `address` (obligatoria, máx. 200) y `notes` (opcional, máx. 280). No se usa `meet_at` ni se cargan coordenadas (no hay geocodificación ni agenda).
  "Cómo llegar" lo resuelve la app con la dirección, abriendo Google Maps fuera de Hallado.

**MeetingView** (lo que devuelven las tres rutas)
```json
{
  "claimId": "c_...",
  "iHaveTheObject": false,
  "otherParty": { "id": "u_...", "name": "Bruno" },
  "meetingPoint": {
    "id": "m_...", "address": "Estación Primera Junta", "notes": "Entrada principal",
    "latitude": null, "longitude": null, "status": "proposed",
    "proposedByMe": false, "proposedBy": { "id": "u_...", "name": "Bruno" },
    "createdAt": "2026-10-25T10:00:00.000Z", "respondedAt": null
  },
  "canPropose": true,
  "canAccept": true,
  "reason": null
}
```
- `meetingPoint` es `null` si todavía no hay ninguna propuesta vigente.
- `canPropose` / `canAccept` dicen qué puede hacer **quien consulta** ahora; si ninguna es `true`, `reason` explica por qué (espera, ya acordado o no le corresponde).
- `latitude` / `longitude` solo vienen si el punto las tiene cargadas (por ejemplo, datos del seed); si no, `null`.

### GET `/reclamos/:id/punto-encuentro`
200: `MeetingView`.

Errores: 404 `Reclamo no encontrado.` (también si no es parte) · 409 `La coordinación del encuentro se habilita cuando el reclamo está aceptado.`

### POST `/reclamos/:id/punto-encuentro`
Propone el primer lugar o sugiere otro. Body: `{ "address": "Av. Cabildo 2000", "notes": "opcional" }`. 201: `MeetingView` con el estado nuevo.

Errores:
- 403 `Todavía no hay un lugar propuesto. Lo propone quien tiene el objeto.`
- 404 `Reclamo no encontrado.`
- 409 `La coordinación del encuentro se habilita cuando el reclamo está aceptado.` / `El punto de encuentro ya fue acordado.` / `Esperando la respuesta de la otra persona.` / `El punto de encuentro cambió, actualizá la pantalla.`
- 422 `La dirección es obligatoria.` / textos largos o con caracteres no permitidos.

### POST `/puntos-encuentro/:id/aceptar`
Sin body. La parte que no propuso acepta el lugar vigente. 200: `MeetingView`.

Errores:
- 403 `No podés aceptar tu propia propuesta: responde la otra persona.`
- 404 `Punto de encuentro no encontrado.` (también si no es parte del reclamo)
- 409 `El punto de encuentro ya fue acordado.` / `Esta propuesta fue reemplazada por otra. Actualizá la pantalla.` / `La coordinación del encuentro se habilita cuando el reclamo está aceptado.`

---

## Buscador (punto 3)

Todas estas rutas requieren token. Rate limit: el de `/users/*` (300 / 15 min por usuario).

### GET `/categorias`
Catálogo de categorías, ordenado por `sort_order`.

200: `[{ "id": "documents", "name": "Documentos" }, ...]`

### GET `/publicaciones`
Lista las publicaciones de un tipo. **El servidor no invierte nada**: la app pide `tipo=found` si la persona perdió algo y `tipo=lost` si lo encontró.
Solo trae publicaciones `open` o `in_claim` que no hayan vencido (`expires_at > now()`) y **nunca las propias**.

Esta ruta es solo el listado (`GET /publicaciones`). El detalle (`/publicaciones/:id`) es de otro punto.

Query string:

| Parámetro | Obligatorio | Valores |
|---|---|---|
| `tipo` | Sí | `lost` \| `found`: el tipo de publicación que se devuelve |
| `categoria` | No | id de `/categorias` |
| `q` | No | palabras clave, máx. 100 caracteres. Busca en título y descripción (español, `plainto_tsquery`) |
| `barrio` | No | id de `/barrios`. Filtra por ese barrio |
| `lat`, `lng`, `radio` | No, pero van **juntos** | `lat` -90 a 90, `lng` -180 a 180, `radio` entero en metros de 100 a 50000. Filtra por distancia |
| `desde`, `hasta` | No, cada uno por separado | `AAAA-MM-DD`, ambos extremos incluidos. Se aplican a la fecha del suceso (`occurredOn`). Si van los dos, `desde` ≤ `hasta` |
| `orden` | No | `recientes` (por defecto, más nuevas primero) \| `cercanos` |
| `pagina` | No | entero desde 1 (máx. 1000). Por defecto 1 |
| `limite` | No | entero de 1 a 50. Por defecto 20 |

- `orden`, `pagina` y `limite` **no están en la guía del equipo: se agregan por la consigna** (resultados ordenables y paginados).
- Los atajos de período ("hoy", "3 días", "una semana") **no existen en la API**: la app los convierte a `desde`/`hasta` con el día de Buenos Aires antes de llamar.
- `orden=cercanos` necesita un centro: `lat`+`lng`, o `barrio` (se usa el centro del barrio). Sin ninguno, 422.
  Se ordena por distancia (Haversine) y cada item trae `distanceM`.
- **Privacidad de ubicación**: el filtro por radio y el orden por cercanía se calculan sobre las coordenadas **redondeadas a 3 decimales**
  (`round(p.latitude::numeric, 3)`, las mismas que se devuelven en `lat`/`lng`), nunca sobre las exactas.
  Una publicación sin coordenadas propias usa el centro de su barrio, redondeado igual (3 decimales).
  `distanceM` se devuelve **redondeado a múltiplos de 100 m**.
- `q` formada solo por palabras vacías del español (por ejemplo `de la`): la consulta de texto queda sin términos y **se ignora el filtro**
  (no devuelve 0 resultados).

200:
```json
{
  "items": [
    {
      "id": "p_ab12...",
      "type": "found",
      "title": "Llaves con llavero de osito",
      "status": "open",
      "category": { "id": "keys", "name": "Llaves" },
      "neighborhood": { "id": "palermo", "name": "Palermo" },
      "occurredOn": "2026-10-24",
      "timeFrom": "09:00",
      "timeTo": "12:00",
      "lat": -34.581,
      "lng": -58.426,
      "photoUrls": ["http://localhost:3000/photos/3f2c1a9e-0b7d-4c1e-9a8f-2d6b5e7c8a90"],
      "distanceM": 900
    }
  ],
  "page": 1,
  "limit": 20,
  "hasMore": false
}
```
- `lat` y `lng` salen **redondeadas a 3 decimales** (~110 m) o `null`. `timeFrom` y `timeTo` pueden ser `null`.
- `photoUrls` va ordenado por posición (puede estar vacío). `distanceM` (metros, múltiplo de 100) solo viene con `orden=cercanos`.
- **No se devuelve** la dirección exacta, la pregunta ni la respuesta de verificación.

Errores (todos 422, `message` en español): falta o es inválido el tipo; categoría, barrio o palabras clave inválidos;
`lat`/`lng`/`radio` incompletos o fuera de rango; fechas inválidas o `desde` posterior a `hasta`; orden `cercanos` sin centro;
página o límite fuera de rango; `El barrio no existe.` (con `orden=cercanos` y un barrio desconocido).

### GET `/busquedas-recientes`
Las últimas 10 búsquedas del usuario, de la más nueva a la más vieja.

200:
```json
[
  {
    "id": "5eed0000-0000-4000-8000-0000000000b1",
    "tipo": "found",
    "categoria": "keys",
    "q": "llaves",
    "barrio": "palermo",
    "lat": -34.579,
    "lng": -58.4298,
    "radio": 1500,
    "periodo": "rango",
    "desde": "2026-09-27",
    "hasta": "2026-10-27",
    "createdAt": "2026-10-27T10:00:00.000Z"
  }
]
```
Los campos sin valor vienen en `null`. `periodo` es `hoy`, `3d`, `7d` o `rango`; `desde`/`hasta` solo vienen con `rango`.

### POST `/busquedas-recientes`
Guarda una búsqueda. Body JSON con los mismos nombres que `/publicaciones`: `tipo` (obligatorio), `categoria`, `q`, `barrio` y
`lat`+`lng`+`radio`; más `periodo` (`hoy` \| `3d` \| `7d` \| `rango`) y `desde`/`hasta` **solo con `rango`** (y entonces son obligatorios, `AAAA-MM-DD`).
`orden`, `pagina` y `limite` no se guardan.

- El período se guarda tal cual: `hoy`, `3d` y `7d` quedan sin fechas (la app los vuelve a convertir al repetir la búsqueda).
  Con `rango` se guardan `desde`/`hasta`. Requiere la migración `009_recent_searches_period.sql`.
- Si ya existe una búsqueda **idéntica**, no se duplica: se actualiza su fecha y vuelve a ser la primera.
- Conserva solo las últimas 10 por usuario (se recorta en la misma transacción).

201: la búsqueda guardada (misma forma que un elemento de la lista).

Errores: 422 por los mismos motivos que `/publicaciones` (más `El período tiene que ser hoy, 3d, 7d o rango.` y `desde y hasta solo se usan con el período rango.`),
y `La categoría no existe.` / `El barrio no existe.`

### DELETE `/busquedas-recientes/:id`
Borra una búsqueda reciente **propia**.

204 sin cuerpo. Errores: 404 `Búsqueda no encontrada.` (no existe, el id no es válido o es de otra persona; no se distingue).

---

## Publicaciones (punto 5)

Todas requieren token. Rate limit general: el mismo de `/users/*` (300 pedidos / 15 min por usuario).

Para publicar con fotos, primero se sube cada foto (`POST /publicaciones/fotos`) y después se crea la publicación con los `photoIds`. Es el mismo patrón que usan los reclamos. Si se pierde la conexión a mitad de camino, la app reintenta todo con el **mismo `clientId`** y el servidor no duplica la publicación.

### Objeto `OwnPublication`
Lo que ve **quien publicó**. Incluye la dirección exacta y la respuesta de verificación, que nunca se le mandan a otra persona.

```json
{
  "id": "p_3f2c1a9e0b7d4c1e9a8f2d6b",
  "clientId": "0f8fad5b-d9cb-469f-a165-70867728950e",
  "type": "found",
  "title": "Llaves con llavero rojo",
  "description": "Estaban en un banco de la plaza",
  "category": { "id": "keys", "name": "Llaves" },
  "occurredOn": "2026-10-25",
  "timeFrom": "09:00",
  "timeTo": "10:30",
  "neighborhood": { "id": "palermo", "name": "Palermo" },
  "exactAddress": "Plaza Armenia, banco junto a la calesita",
  "latitude": null,
  "longitude": null,
  "verificationQuestion": "¿De qué color es el llavero?",
  "verificationAnswer": "Rojo",
  "status": "open",
  "expiresAt": "2026-11-26T12:00:00.000Z",
  "renewedAt": null,
  "createdAt": "2026-10-27T12:00:00.000Z",
  "photoUrls": ["http://localhost:3000/photos/7c9e6679-7425-40de-944b-e07fc1f90ae7"]
}
```

- `type`: `lost` (perdí) o `found` (encontré).
- `status`: `open`, `in_claim`, `resolved` o `expired`.
- `occurredOn`: fecha sin hora (`YYYY-MM-DD`). `timeFrom` / `timeTo`: franja horaria opcional (`HH:MM`).
- `verificationQuestion` / `verificationAnswer`: solo en `found`. En `lost` son `null`.
- `photoUrls`: en el orden en que se cargaron (hasta 5).

### POST `/publicaciones/fotos`
Sube una foto para usarla en una publicación. Mismas reglas de formato y tamaño que `POST /users/me/photo`.

201: `{ "photoId": "7c9e6679-7425-40de-944b-e07fc1f90ae7" }`

- La foto no se ve en `GET /photos/:id` hasta que forme parte de una publicación.
- Si pasan **24 horas** y no se usó en ninguna publicación, el servidor la borra (pasa cuando se corta la conexión a mitad de publicar).
- Rate limit propio: **30 subidas / hora** por usuario (una publicación puede llevar 5).
- Errores: los mismos que `POST /users/me/photo`.

### POST `/publicaciones`
Crea una publicación. Vence a los **30 días** (`expiresAt` lo fija el servidor).

```json
{
  "clientId": "0f8fad5b-d9cb-469f-a165-70867728950e",
  "type": "found",
  "title": "Llaves con llavero rojo",
  "description": "Estaban en un banco de la plaza",
  "categoryId": "keys",
  "occurredOn": "2026-10-25",
  "timeFrom": "09:00",
  "timeTo": "10:30",
  "neighborhoodId": "palermo",
  "exactAddress": "Plaza Armenia, banco junto a la calesita",
  "latitude": null,
  "longitude": null,
  "verificationQuestion": "¿De qué color es el llavero?",
  "verificationAnswer": "Rojo",
  "photoIds": ["7c9e6679-7425-40de-944b-e07fc1f90ae7"]
}
```

- `clientId`: UUID que genera la app. Si ya existe una publicación de ese usuario con ese `clientId`, **no crea otra**: responde 200 con la existente.
- Obligatorios: `clientId`, `type`, `title` (máx. 80), `categoryId`, `occurredOn` (no puede ser futura), `neighborhoodId`, y `exactAddress` (máx. 200) **o** `latitude` + `longitude`.
- Opcionales: `description` (máx. 500), `timeFrom`, `timeTo`, `photoIds` (máx. 5).
- `found`: `verificationQuestion` y `verificationAnswer` obligatorias (máx. 200 cada una). En `lost` se ignoran.
- `latitude` y `longitude` van juntas o ninguna.
- Las fotos tienen que ser del mismo usuario, subidas con `POST /publicaciones/fotos` y sin usar en otra publicación.

201: `OwnPublication` (nueva) · 200: `OwnPublication` (ya existía ese `clientId`)

Errores (422):
- `Falta el identificador de la publicación.`
- `Indicá si perdiste o encontraste algo.`
- `Escribí un título.`
- `Elegí una categoría.` / `Elegí una categoría válida.`
- `La fecha del suceso no es válida.`
- `La hora desde tiene que tener el formato HH:MM.`
- `La hora desde no puede ser posterior a la hora hasta.`
- `Elegí un barrio.` / `Elegí un barrio válido.`
- `Escribí la dirección o usá tu ubicación actual.`
- `La ubicación no es válida.`
- `Escribí la pregunta de verificación.` / `Escribí la respuesta a la pregunta de verificación.`
- `Podés subir hasta 5 fotos.` / `Hay fotos repetidas.` / `Las fotos no son válidas.`
- `Alguna foto no es válida. Volvé a elegirlas.`

### GET `/publicaciones/mias`
"Mis publicaciones": las del usuario, de la más nueva a la más vieja (máximo 100).

200: `OwnPublication[]`

- Antes de responder, el servidor pasa a `expired` las que ya vencieron.

### POST `/publicaciones/:id/renovar`
Suma 30 días desde hoy. Si estaba `expired`, vuelve a `open`.

200: `OwnPublication`

Errores:
- 404 `Publicación no encontrada.` (no existe o es de otra persona)
- 409 `Una publicación resuelta no se puede renovar.`

El formulario de publicar usa las categorías de `src/constants/categories.js` (mismos ids que `GET /categorias`) en vez de pedirlas, así se puede completar sin conexión:
`documents`, `keys`, `electronics`, `pets`, `clothing`, `other`.

---

## Complementarios

### GET `/photos/:id`
Devuelve una foto.

- 200: cuerpo binario, `Content-Type: image/jpeg`.
- **Foto de perfil vigente**: no requiere token y se puede cachear (`Cache-Control: public, max-age=31536000, immutable`). Una foto de perfil reemplazada da 404.
- **Foto de un reclamo**: requiere `Authorization: Bearer <token>` y solo la reciben quien reclamó y quien publicó. Se responde con
  `Cache-Control: private, no-store`. Sin token válido da 401; con el token de otra persona da 404 (igual que si no existiera).
- **Foto de una publicación**: no requiere token y se puede cachear, igual que la de perfil.
- 404 `Foto no encontrada.` (también si el `:id` no es un UUID).
- Rate limit: 1000 pedidos / 15 min por IP.

### GET `/health`
Sin token. 200: `{ "status": "ok" }`.

---

## Detalle de publicación (punto 4)

### GET `/publicaciones/:id`
Detalle de una publicación. Requiere token. Rate limit: los mismos de `/users/*`.

200:
```json
{
  "id": "p_ab12...",
  "type": "found",
  "title": "Llaves con llavero de osito",
  "description": "Encontré un juego de 3 llaves con un llavero de peluche en la plaza.",
  "status": "open",
  "category": { "id": "keys", "name": "Llaves" },
  "neighborhood": { "id": "palermo", "name": "Palermo" },
  "occurredOn": "2026-10-24",
  "timeFrom": "09:00",
  "timeTo": "12:00",
  "exactAddress": null,
  "isOwner": false,
  "isFollowing": false,
  "photoUrls": ["http://localhost:3000/photos/3f2c1a9e-0b7d-4c1e-9a8f-2d6b5e7c8a90"],
  "publisher": { /* igual que GET /users/:id/public */ }
}
```
- `exactAddress`: solo para quien publicó o quien tiene un reclamo `accepted` sobre esta publicación. Para el resto llega `null`.
- `isOwner`: si quien pide es quien publicó. `isFollowing`: si quien pide la sigue.
- No incluye la pregunta ni la respuesta de verificación, ni el mail o el teléfono del publicador.
- `status`: si ya llegó el vencimiento y seguía `open` o `in_claim`, llega `expired`.
- `photoUrls` va ordenado por posición (puede estar vacío) y se piden con `GET /photos/:id`, sin token.
  `description`, `timeFrom` y `timeTo` pueden ser `null`.

Errores: 401 sin token o con token inválido; 404 `Publicación no encontrada.` (también si el `:id` tiene formato inválido).
Además, los generales de Convenciones (500 y 503).

### POST `/seguidas`
Seguir una publicación. Requiere token. Body: `{ "publicacionId": "p_ab12..." }`

204 sin cuerpo. Seguir dos veces la misma publicación no es un error.

Errores: 401 sin token o con token inválido; 404 `Publicación no encontrada.` (no existe, o falta `publicacionId` o tiene formato inválido).

### DELETE `/seguidas/:publicacionId`
Dejar de seguir una publicación. Requiere token. 204 sin cuerpo, aunque no la siguiera.

Errores: 401 sin token o con token inválido; 404 `Publicación no encontrada.` si el id tiene formato inválido.

---

## Pendiente para el backend (todavía no implementado)

- **Reclamos (punto 7)**: implementados, ver la sección "Reclamos". El teléfono de la otra parte ya lo decide el servidor en `Claim.otherParty.phone`.
  Pendiente de otros puntos: el punto de encuentro (punto 8) ya tiene sus rutas (ver "Punto de encuentro"); queda fuera la confirmación de la devolución (`returns`).
- **Esquema de base ya creado, API pendiente**: las migraciones 004 a 008 (probadas solo en una rama de pruebas, no en producción)
  fijan estos estados exactos. Publicaciones: `open`, `in_claim`, `resolved`, `expired`. Reclamos: `pending`, `accepted`, `rejected`, `expired`
  (sin `cancelled`). Puntos de encuentro: `proposed`, `accepted`, `counter_proposed`. Tipos: publicación `lost`/`found`; reclamo `mine`/`found`.
  Detalle y reglas en [`backend/README.md`](backend/README.md), sección "Migraciones y esquema".
- **Reglas a cargo de la API** (la base no las asegura): el reclamo debe estar `accepted` para proponer un punto de encuentro y quien propone
  es una de las dos partes; se puede valorar hasta 7 días después de la devolución; el reclamo vence a las 48 h y la publicación a los 30 días
  (lo fija el endpoint); `verification_answer` y `exact_address` son privadas; `client_id` lo genera la app (idempotencia offline).
- **Seguidas**: la novedad es `publications.status_changed_at > follows.seen_at`.
- **Historial de devoluciones**: hoy `completedReturns` es solo un contador.

## Datos de ejemplo (seed)

Contraseña de todos: `hallado123`. Los mismos datos están en `backend/scripts/seed.js` y en el mock de la app.

| Email | Devoluciones | Valoraciones | Puntos | % positivo |
|---|---|---|---|---|
| lucia@hallado.com | 12 | 18 positivas / 1 negativa | 151 | 95 |
| martin@hallado.com | 5 | 6 positivas | 62 | 100 |
| carlos@hallado.com | 2 | 1 positiva / 3 negativas | 7 | 25 |
| sofia@hallado.com | 0 | ninguna | 0 | null |
