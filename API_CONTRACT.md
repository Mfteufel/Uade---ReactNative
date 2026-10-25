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
| `GET /photos/:id` | 1000 pedidos / 15 min | IP |
| Todo `/reclamos/*`, `/publicaciones/:id/reclamos/*` y `/barrios` | 300 pedidos / 15 min (mismo contador que `/users/*`) | Usuario |
| `/reclamos/*`, `/publicaciones/:id/reclamos/*` y `/barrios` sin token válido | 100 respuestas 401 / 15 min | IP |
| `POST /reclamos/foto` | 10 subidas / hora (cuenta también las fallidas) | Usuario |

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
  Los demás reclamos `pending` de esa publicación no cambian de estado (la guía no define una regla): el publicador puede rechazarlos o vencen a las 48 h.
- Solo el publicador acepta o rechaza, y solo un reclamo `pending` que no venció.
- **Privacidad**: la respuesta de verificación correcta **nunca** sale del servidor. El publicador ve la respuesta que escribió el solicitante y
  `answerMatches` (comparación sin mayúsculas, acentos ni espacios de más); el solicitante no ve ninguna de las dos.
  El teléfono de la otra parte solo viene si el reclamo está `accepted`, esa persona dejó `phoneVisibleOnClaim` en `true` y cargó un teléfono.

**Claim** (lo que devuelven las rutas de reclamos; `GET /reclamos/:id` suma `attemptsLeft` si quien consulta es el solicitante)
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
- `photoUri`: foto del reclamo (se sirve con `GET /photos/:id`) o `null`.

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
una subida a la vez por usuario, 10 por hora). La foto queda con `kind = 'claim'`. Una foto subida y nunca usada en un reclamo queda sin referencia.

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

## Complementarios

### GET `/photos/:id`
Devuelve una foto. **No requiere token.** La usa la app para mostrar `photoUri` (fotos de perfil y fotos de reclamos).

- 200: cuerpo binario, `Content-Type: image/jpeg`.
- Solo sirve la **foto vigente** de algún usuario o una foto **adjunta a un reclamo**. Una foto de perfil reemplazada da 404.
- Las fotos de reclamo no tienen otra protección que su UUID (imposible de adivinar): solo se lo da `Claim.photoUri` a las dos partes del reclamo.
- Caché: `Cache-Control: public, max-age=31536000, immutable`. Se puede cachear por un año.
- 404 `Foto no encontrada.` (también si el `:id` no es un UUID).
- Rate limit: 1000 pedidos / 15 min por IP.

### GET `/health`
Sin token. 200: `{ "status": "ok" }`.

---

## Pendiente para el backend (todavía no implementado)

- **Reclamos (punto 7)**: implementados, ver la sección "Reclamos". El teléfono de la otra parte ya lo decide el servidor en `Claim.otherParty.phone`.
  Pendiente de otros puntos: el detalle de publicación (punto 4) tiene que mostrar `exact_address` también a quien tenga un reclamo `accepted`
  sobre esa publicación (consultando `claims`), y el punto de encuentro (punto 8) todavía no tiene rutas.
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
