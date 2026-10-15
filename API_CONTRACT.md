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

### Códigos de error usados

| Status | Cuándo |
|---|---|
| 400 | Código OTP incorrecto o no se pidió código. Foto mal formada. JSON inválido. |
| 401 | Credenciales incorrectas, token inválido o vencido, registro vencido. |
| 404 | Usuario, cuenta o foto inexistente. Ruta inexistente. |
| 408 | La subida de foto tardó demasiado. Timeout del cliente (lo genera la app). |
| 409 | Email ya registrado. |
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

## Complementarios

### GET `/photos/:id`
Devuelve la foto de perfil. **No requiere token.** La usa la app para mostrar `photoUri`.

- 200: cuerpo binario, `Content-Type: image/jpeg`.
- Solo sirve la **foto vigente** de algún usuario. Una foto reemplazada da 404.
- Caché: `Cache-Control: public, max-age=31536000, immutable`. Se puede cachear por un año.
- 404 `Foto no encontrada.` (también si el `:id` no es un UUID).
- Rate limit: 1000 pedidos / 15 min por IP.

### GET `/health`
Sin token. 200: `{ "status": "ok" }`.

---

## Pendiente para el backend (todavía no implementado)

- **Reclamos**: cuando existan, el back debe devolver el teléfono de la otra parte
  **solo** si el reclamo está `accepted`, `phoneVisibleOnClaim` es `true` y hay teléfono cargado.
  La app tiene la misma regla en `src/utils/canShowPhone.js`, pero la decisión real tiene que tomarla el servidor.
- **Historial de devoluciones**: hoy `completedReturns` es solo un contador.

## Datos de ejemplo (seed)

Contraseña de todos: `hallado123`. Los mismos datos están en `backend/scripts/seed.js` y en el mock de la app.

| Email | Devoluciones | Valoraciones | Puntos | % positivo |
|---|---|---|---|---|
| lucia@hallado.com | 12 | 18 positivas / 1 negativa | 151 | 95 |
| martin@hallado.com | 5 | 6 positivas | 62 | 100 |
| carlos@hallado.com | 2 | 1 positiva / 3 negativas | 7 | 25 |
| sofia@hallado.com | 0 | ninguna | 0 | null |
