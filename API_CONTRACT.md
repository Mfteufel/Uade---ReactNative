# API Contract — Hallado (Puntos 1 y 2)

Endpoints que la app espera del backend. Hoy los simula `src/api/mock/` (con `USE_MOCK = true`).
Cuando exista el back: `USE_MOCK = false` en `src/config.js` y ajustar `API_URL`.

## Convenciones

- Base URL: `API_URL` (`http://10.0.2.2:3000` desde el emulador Android).
- Body y respuestas en JSON (salvo la foto: `multipart/form-data`).
- Rutas protegidas: header `Authorization: Bearer <accessToken>`.
- Fechas en ISO 8601 (`2026-09-15T12:00:00.000Z`).
- **Errores**: HTTP con status 4xx/5xx y body `{ "message": "Texto para mostrar al usuario" }`.
  La app muestra `message` tal cual, en español.
- El cliente (`src/api/client.js`) tiene timeout de 10 s. Reintenta **solo GET** (2 veces, ante error de red, timeout o 5xx). Nunca POST/PUT.

### Códigos de error usados

| Status | Cuándo |
|---|---|
| 400 | Código OTP incorrecto, o no se pidió código |
| 401 | Credenciales inválidas, token inválido/vencido |
| 404 | Usuario inexistente |
| 408 | Timeout (lo genera el cliente) |
| 409 | Email ya registrado |
| 410 | OTP vencido |
| 422 | Dato inválido (email, contraseña corta, nombre vacío) |
| 429 | Demasiados intentos de OTP, o reenvío antes de 60 s |

## Reglas del OTP

- 6 dígitos numéricos.
- Vence a los **10 minutos** (`expiresInSec: 600`).
- Máximo **5 intentos fallidos**; al 5.º se invalida y hay que pedir uno nuevo (429).
- Pedir un código nuevo **invalida el anterior**.
- Mínimo **60 s** entre envíos al mismo email (429 si se pide antes).
- Se usa una sola vez.
- El mock agrega `devCode` en la respuesta para mostrarlo en pantalla. **El backend real NO debe devolverlo**; el código llega por email.

## Objetos

**Session**
```json
{
  "user": { /* User */ },
  "accessToken": "string",
  "refreshToken": "string"
}
```

**User** (datos propios, privados)
```json
{
  "id": "u_lucia",
  "email": "lucia@hallado.com",
  "name": "Lucía Fernández",
  "photoUri": "https://... | null",
  "neighborhood": "Palermo",
  "phone": "+54 11 5555-0001",
  "phoneVisibleOnClaim": true,
  "createdAt": "2024-03-10T12:00:00.000Z"
}
```

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
- `positivePercent`: entero 0-100, o `null` si no tiene valoraciones.
- Las insignias **no** las devuelve el back: la app las calcula con `src/constants/badges.js`.

---

## Autenticación

### POST `/auth/register/request-otp`
Paso 1 del registro. También sirve para reenviar el código.

Body: `{ "email": "nuevo@mail.com" }`

200:
```json
{ "message": "Te enviamos un código de 6 dígitos.", "expiresInSec": 600, "resendInSec": 60 }
```
Errores: 422 email inválido · 409 email ya registrado · 429 reenvío antes de 60 s.

### POST `/auth/register/verify-otp`
Paso 2.

Body: `{ "email": "nuevo@mail.com", "code": "123456" }`

200: `{ "registrationToken": "string" }` (token de corta vida para el paso 3; el mock lo hace durar 30 min)

Errores: 400 código incorrecto (el mensaje indica cuántos intentos quedan) · 410 vencido · 429 demasiados intentos.

### POST `/auth/register/set-password`
Paso 3. Crea la cuenta e inicia sesión.

Body: `{ "registrationToken": "string", "password": "minimo8car" }`

200: `Session`

Notas: el nombre inicial es la parte del email antes de la `@`; se edita luego en el perfil.
Errores: 401 registro vencido · 422 contraseña de menos de 8 caracteres.

### POST `/auth/login`
Body: `{ "email": "lucia@hallado.com", "password": "hallado123" }`

200: `Session`

Errores: 401 `Email o contraseña incorrectos.` (mismo mensaje para email inexistente o clave mala).

### POST `/auth/refresh`
Body: `{ "refreshToken": "string" }`

200: `Session` (con tokens nuevos)

Errores: 401 refresh token inválido o vencido. La app cierra la sesión.

### POST `/auth/password/request-otp`
Body: `{ "email": "lucia@hallado.com" }`

200: igual que `/auth/register/request-otp`.

Errores: 422 email inválido · 404 no existe la cuenta · 429.

### POST `/auth/password/resend-otp`
Igual que el anterior; invalida el código anterior. Respeta los 60 s.

### POST `/auth/password/reset`
Verifica el código y cambia la contraseña en un solo paso.

Body: `{ "email": "...", "code": "123456", "newPassword": "minimo8car" }`

200: `{ "message": "Contraseña actualizada." }`

Errores: 422 contraseña corta · 400 / 410 / 429 igual que verify-otp · 404.

---

## Usuarios

### GET `/users/me`  🔒
200: `User`

### PUT `/users/me`  🔒
Actualiza solo los campos enviados.

Body (todos opcionales):
```json
{
  "name": "Lucía F.",
  "neighborhood": "Palermo",
  "phone": "+54 11 5555-0001",
  "phoneVisibleOnClaim": false
}
```
200: `User` actualizado

Errores: 422 nombre vacío.

### POST `/users/me/photo`  🔒
`multipart/form-data`, campo `photo` (imagen).

200: `User` actualizado (con `photoUri` nuevo, una URL pública)

En el mock se guarda la URI local del teléfono.

### GET `/users/:id/public`  🔒
Perfil visible para otras personas. **No debe incluir** email, teléfono ni historial de publicaciones.

200:
```json
{
  "id": "u_lucia",
  "name": "Lucía Fernández",
  "photoUri": "https://... | null",
  "memberSince": "2024-03-10T12:00:00.000Z",
  "reputation": { /* Reputation */ }
}
```
Errores: 404.

### GET `/users/:id/reputation`  🔒
200: `Reputation`

Errores: 404.

---

## Pendiente para el backend (no lo usa la app todavía)

- **Privacidad del teléfono**: cuando existan los reclamos, el back debe devolver el teléfono de la otra parte
  **solo** si el reclamo está `accepted`, `phoneVisibleOnClaim` es `true` y hay teléfono cargado.
  La app tiene la misma regla en `src/utils/canShowPhone.js`, pero la decisión real tiene que tomarla el servidor.
- Las rutas marcadas 🔒 deberían responder 401 si el access token venció; la app hoy no renueva
  el token automáticamente en ese caso (solo al abrir la app).

## Datos de ejemplo del mock

Contraseña de todos: `hallado123`.

| Email | Devoluciones | Valoraciones |
|---|---|---|
| lucia@hallado.com | 12 | 18 positivas / 1 negativa |
| martin@hallado.com | 5 | 6 positivas |
| carlos@hallado.com | 2 | 1 positiva / 3 negativas |
| sofia@hallado.com | 0 | ninguna |
