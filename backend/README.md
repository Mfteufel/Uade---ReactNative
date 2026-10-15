# Hallado backend

API REST en Express con PostgreSQL. Cubre autenticación, perfil, foto de perfil y reputación.
El contrato de endpoints está en [`../API_CONTRACT.md`](../API_CONTRACT.md).

## Requisitos

- **Node.js 22**.
- **PostgreSQL 13 o más**. Recomendado: [Neon](https://neon.tech) (plan gratis).
- Opcional: una cuenta de Gmail (o de [Brevo](https://www.brevo.com)) para enviar los códigos por mail.
  Sin ninguna, los códigos salen por la consola del servidor. Ver "Enviar correos reales".

## 1. Crear la base de datos (Neon)

1. Creá una cuenta en Neon.
2. Creá un proyecto nuevo.
3. Copiá la **connection string** del panel. Tiene este formato:
   ```
   postgresql://usuario:clave@host/db?sslmode=require
   ```
4. No la compartas ni la subas al repo. Es una contraseña.

## 2. Configurar el `.env`

```bash
cd backend
cp .env.example .env
```

Completá al menos `DATABASE_URL` y `JWT_SECRET`. Para generar `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

El archivo `.env` está en `.gitignore`. No se sube al repo.

## 3. Instalar, migrar y cargar datos de prueba

```bash
npm install
npm run migrate     # crea las tablas (migrations/001_init.sql)
npm run seed        # carga las cuentas de prueba (ver abajo)
npm start           # levanta el server en http://localhost:3000
```

Para desarrollo con recarga automática: `npm run dev`.

Para probar:

```bash
npm test
```

Health check: `GET /health` responde `{"status":"ok"}`.

> **Aviso**: `npm run seed` **borra y vuelve a crear** las 4 cuentas de prueba
> (`lucia`, `martin`, `carlos`, `sofia`). No lo corras sobre una base compartida sin avisar al equipo.
> Las demás cuentas no se tocan.

## Variables de entorno

| Variable | Obligatoria | Qué hace |
| --- | --- | --- |
| `PORT` | No (por defecto `3000`) | Puerto HTTP del server. |
| `DATABASE_URL` | Sí | Connection string de PostgreSQL. Sin ella el server no puede usar la base. |
| `JWT_SECRET` | Sí | Secreto para firmar los tokens. Si falta, el server no arranca. Usá al menos 32 caracteres. En producción, mínimo 32 o no arranca. |
| `SMTP_HOST` | No (por defecto `smtp.gmail.com`) | Servidor SMTP. |
| `SMTP_PORT` | No (por defecto `465`) | Puerto SMTP (1-65535). Con `465` la conexión es TLS directa; con otro (p. ej. `587`) no. |
| `SMTP_USER` | Con `SMTP_PASS` | Usuario SMTP (tu Gmail). Con `SMTP_USER` y `SMTP_PASS` se envía por SMTP. |
| `SMTP_PASS` | Con `SMTP_USER` | Contraseña de aplicación de Google. Es un secreto: solo en `.env`. |
| `BREVO_API_KEY` | Alternativa | API key de Brevo. Se usa si no hay SMTP. |
| `MAIL_FROM` | Con Brevo (opcional con SMTP) | Remitente. Con Brevo tiene que estar verificado; con SMTP por defecto es `SMTP_USER`. |

En producción hace falta SMTP (`SMTP_USER` + `SMTP_PASS`) o Brevo (`BREVO_API_KEY` + `MAIL_FROM`); si no, el server no arranca. Prioridad: SMTP, Brevo, consola.
| `PUBLIC_URL` | Solo en producción | URL pública del backend, sin path. Es la base de `photoUri`. Ver abajo. |
| `NODE_ENV` | No (por defecto `development`) | `production` activa las validaciones estrictas y desactiva el log de pedidos. |
| `TRUST_PROXY` | No (por defecto `0`) | Cantidad de proxies delante del server. Solo hace falta detrás de un proxy o un hosting, para que el rate limit use la IP real. |
| `UPLOAD_TIMEOUT_MS` | No (por defecto `30000`) | Tiempo máximo de una subida de foto, en milisegundos. |

En desarrollo, sin SMTP ni Brevo configurados, el código de verificación se imprime en la consola del servidor:
`[MAIL DEV] código register para lucia@...: 123456`.

## Enviar correos reales

**a) Gmail (SMTP)**

1. Activá la verificación en 2 pasos en tu cuenta de Google.
2. Creá una contraseña de aplicación en <https://myaccount.google.com/apppasswords>.
3. En `backend/.env` poné `SMTP_USER=tu@gmail.com` y `SMTP_PASS=<la contraseña de 16 letras, sin espacios>`.
4. Reiniciá el server. Al arrancar verás `[CONFIG] Mail: smtp (smtp.gmail.com:465)`.
5. Pedí un código: en el log debe aparecer `[MAIL] enviado a ...`. Si falla, aparece `[MAIL] error al enviar: SMTP <código>` y el endpoint responde `502`.

**b) Alternativa: Brevo.** Poné `BREVO_API_KEY` y `MAIL_FROM` (remitente verificado en Brevo). Se usa solo si no hay `SMTP_USER`/`SMTP_PASS`.

**c) Sin ninguna.** El código sale por la consola del servidor (`[MAIL DEV] ...`). Solo sirve en desarrollo.

**Avisos**

- Gmail limita los envíos diarios (verificá el tope vigente en la documentación de Google); alcanza para pruebas, no para mucho tráfico.
- Algunos hostings bloquean los puertos SMTP salientes. Si pasa al desplegar, usá un proveedor por API HTTP (como Brevo).
- La contraseña de aplicación es un secreto: va solo en `.env`, nunca en el repo. Se revoca desde la cuenta de Google.

### PUBLIC_URL (fotos de perfil)

`photoUri` se arma como `${PUBLIC_URL}/photos/<uuid>`. Tiene que ser alcanzable **desde el celular**.
Tiene que coincidir con `EXPO_PUBLIC_API_URL` de la app. No puede tener path, query ni hash.

En desarrollo, si no se define, usa `http://localhost:PORT`.

| Caso | Valor de `PUBLIC_URL` |
| --- | --- |
| Celular por USB (con `adb reverse tcp:3000 tcp:3000`) | `http://localhost:3000` |
| Emulador Android | `http://10.0.2.2:3000` |
| Red local (LAN) | `http://192.168.x.y:3000` (la IP de la PC) |
| Producción | `https://tu-dominio` (obligatoria, https) |

## Cuentas del seed

Contraseña de todas: `hallado123`.

| Email | Devoluciones | Valoraciones | Puntos | % positivo |
| --- | --- | --- | --- | --- |
| lucia@hallado.com | 12 | 18 positivas / 1 negativa | 151 | 95 |
| martin@hallado.com | 5 | 6 positivas | 62 | 100 |
| carlos@hallado.com | 2 | 1 positiva / 3 negativas | 7 | 25 |
| sofia@hallado.com | 0 | ninguna | 0 | sin dato |

Puntos: `devoluciones × 10 + positivas × 2 − negativas × 5` (mínimo 0).

## Logs de desarrollo

Con `NODE_ENV` distinto de `production` el server imprime:

- `[req]`: cada pedido. Método, ruta (sin query), estado y tamaño. Nunca cuerpos ni headers.
- `[upload]`: cada subida de foto. Tamaño y resultado. Nunca el contenido.
- `[db]`: errores de conexión con la base y consultas lentas.

También aparecen `[MAIL]` (envío de mails), `[MAIL DEV]` (código en consola) y `[AUTH]` (reuso de refresh token).

## Solución de problemas

- **`EAI_AGAIN` / `ENOTFOUND`**: no se resuelve el nombre de la base. Es un problema de DNS o de red.
  Probá cambiar el DNS de la PC (por ejemplo `1.1.1.1` o `8.8.8.8`) o cambiar de red.
- **`ETIMEDOUT`**: la base no contesta a tiempo. Suele pasar con wifi inestable. Probá de nuevo o cambiá de red.
- **Respuesta `503` con "El servicio no está disponible por un momento"**: el server no llega a la base.
  Mirá las líneas `[db]` de la consola.
- **Puerto 3000 ocupado**: cambiá `PORT` en `.env`. Recordá actualizar `PUBLIC_URL` y el `adb reverse` a ese puerto.
  Para ver qué lo usa: `lsof -i :3000` (Linux/macOS).
- **`Falta JWT_SECRET`**: completá `JWT_SECRET` en `.env`.
- **`Falta PUBLIC_URL en producción`**: definí `PUBLIC_URL` con `https://`.
- **`502` al pedir un código**: falló el envío del mail. Revisá las credenciales (`SMTP_USER`/`SMTP_PASS` o `BREVO_API_KEY`/`MAIL_FROM`) y la línea `[MAIL]`.

## Estructura

```
backend/
  src/
    index.js           app Express, montaje de rutas y rate limits
    config.js          lectura y validación de variables de entorno
    db.js              pool de PostgreSQL, query y transacciones
    routes/            auth.js, users.js, photos.js
    middleware/        auth (token), rateLimit, upload (fotos), errors
    services/          tokens, session, registration, passwordReset,
                       otp, otpStore, mailer, passwordRules,
                       profile, photos, photoUrl, reputation, publicProfile
  migrations/          001_init.sql (esquema)
  scripts/
    migrate.js         aplica las migraciones pendientes
    seed.js            carga las cuentas de prueba
  test/                tests con node --test
  .env.example         plantilla de variables de entorno
```
