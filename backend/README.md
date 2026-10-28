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
npm run migrate     # aplica las migraciones 001 a 008 (ver "Migraciones y esquema")
npm run seed        # carga las cuentas de prueba (ver abajo)
npm start           # levanta el server en http://localhost:3000
```

Para desarrollo con recarga automática: `npm run dev`.

Para probar:

```bash
npm test
```

Health check: `GET /health` responde `{"status":"ok"}`.

> **ADVERTENCIA**: `backend/.env` apunta a **PRODUCCIÓN**. Un `npm run migrate` normal **modifica producción**.
> Para probar, usá una rama de Neon con un archivo `.env.<rama>.local` (ignorado por git) y verificá el host antes de correr nada.
>
> **ADVERTENCIA**: `npm run seed` (`scripts/seed.js`) **borra y vuelve a insertar** los usuarios de ejemplo
> `u_lucia`, `u_martin`, `u_carlos` y `u_sofia`. **No lo corras sobre una base con datos reales** después de las
> migraciones 002 a 008: las FK en cascada arrastrarían sus publicaciones, reclamos y demás datos.
> Las demás cuentas no se tocan.

## Migraciones y esquema

`node scripts/migrate.js` (`npm run migrate`) aplica, en orden de nombre, todo `.sql` de `backend/migrations/` que
no figure en `schema_migrations`. **No** aplica los de `migrations/rollback/`. Cada migración es idempotente y va en `BEGIN; ... COMMIT;`.

| Migración | Qué crea |
| --- | --- |
| `001_init.sql` | `users`, `otp_codes`, `refresh_tokens`, `photos`, `returns`, `ratings` |
| `002_catalogs.sql` | función `set_updated_at()`, `categories`, `neighborhoods`, `badges` (con filas de catálogo) |
| `003_users_profile.sql` | `users.updated_at` y `users.neighborhood_id`, `photos.kind`, `user_badges` |
| `004_publications.sql` | `publications`, `publication_photos` |
| `005_claims.sql` | `claims` |
| `006_meeting_points.sql` | `meeting_points` |
| `007_returns_ratings_thanks.sql` | columnas nuevas en `returns` y `ratings`, tabla `thanks` |
| `008_alerts_follows_searches.sql` | `alerts`, `follows`, `recent_searches` |

Con las ocho aplicadas hay 18 tablas de datos, más `schema_migrations` (que crea `migrate.js`), o sea 19 en total.

### Estados y tipos (CHECK, no ENUM)

| Dónde | Valores permitidos |
| --- | --- |
| `publications.type` | `lost`, `found` |
| `publications.status` | `open`, `in_claim`, `resolved`, `expired` |
| `claims.type` | `mine` ("es mío", solo sobre una `found`), `found` ("lo encontré", solo sobre una `lost`) |
| `claims.status` | `pending`, `accepted`, `rejected`, `expired` (**no existe `cancelled`**) |
| `meeting_points.status` | `proposed`, `accepted`, `counter_proposed` |
| `photos.kind` | `profile`, `publication`, `claim` |
| `badges.metric` | `completedReturns`, `positiveRatings`, `points` |
| `alerts.publication_type`, `recent_searches.type` | `lost`, `found` (o NULL) |

Otros límites que sí aplica la base: máximo 5 fotos por publicación (`publication_photos.position` de 0 a 4),
`claims.attempt_number` de 1 a 3 (máximo 3 intentos por persona y publicación), `ratings.comment` hasta 280 caracteres,
`thanks.message` de 1 a 500, un solo punto de encuentro vigente por reclamo, un solo agradecimiento por devolución,
y que una `alerts` tenga al menos un criterio. Una publicación `found` exige pregunta y respuesta de verificación; una `lost` no puede tenerlas.
Ids que genera el backend: `p_` (publicaciones), `c_` (reclamos), `m_` (puntos de encuentro), `a_` (alertas), más 24 hex.
`publications.client_id` lo genera la app (idempotencia offline): `ON CONFLICT (user_id, client_id) DO NOTHING`.

### Reglas que quedan a cargo de la API (no de la base)

- **Vencimientos**: los fija el endpoint, la base solo guarda `expires_at` con un default. Reclamo: 48 h. Publicación: 30 días (al renovar se actualizan `expires_at` y `renewed_at`).
  Pasar a `expired` es un `UPDATE ... WHERE expires_at < now()` (antes de leer o con un cron).
- **Reclamos**: `attempt_number` = máximo + 1 dentro de la transacción; al aceptar, la publicación pasa a `in_claim`; al rechazar o vencer se reabre.
  La respuesta de verificación se compara solo en el servidor.
- **Puntos de encuentro**: solo se propone si el reclamo está `accepted`, y quien propone debe ser el publicador o el reclamante. Responde la parte que no propuso.
- **Valoraciones**: se puede valorar hasta **7 días** después de `returns.created_at`. Valoran solo las dos partes de la devolución.
  Agradece quien recuperó a quien devolvió.
- **Privacidad**: `verification_answer` y `exact_address` son privadas (solo las ve quien publicó; `exact_address` también con un reclamo `accepted`).
- **`status_changed_at`**: la API lo actualiza cada vez que cambia `publications.status`.
- Las fotos de una publicación o reclamo deben tener el `photos.kind` correcto y ser del mismo usuario; al borrar la entidad, la API borra sus fotos en la misma transacción.
- `recent_searches` conserva solo las últimas 10 por usuario.

### Cambios a tener en cuenta

- **`follows`**: guarda `seen_at` (timestamp) en lugar de un `estado_visto`. La novedad de una seguida se calcula en la consulta:
  `publications.status_changed_at > follows.seen_at`. "Marcar como vista" pone `seen_at = now()`. Algo parecido pasa con `alerts.last_seen_at`.
- **`ratings.return_id` es NULL en las 29 valoraciones históricas** (y las columnas nuevas de `returns` también). No se tocaron.
  El `UNIQUE (return_id, author_id)` lo permite porque UNIQUE admite NULL.

### Revertir una migración

Los rollback son **manuales**: `migrations/rollback/00N_*.down.sql` (de 002 a 008), uno por migración, y `migrate.js` no los aplica.
Se corren a mano con `psql`, en orden inverso (008 hacia 002), y después hay que borrar la fila de esa migración en `schema_migrations`
para poder volver a aplicarla. **Nunca contra producción** sin un backup y sin avisar al equipo.

### Probar sin tocar producción

1. Creá una rama de Neon y guardá su connection string en `backend/.env.<rama>.local` (el patrón está ignorado por git).
2. Verificá el host de esa rama antes de correr nada (sin imprimir la URL completa en logs ni capturas).
3. Desde `backend/`: `node --env-file=.env.<rama>.local scripts/migrate.js`.
4. `scripts/seed_demo.js` carga datos de ejemplo del esquema completo: solo inserta (`ON CONFLICT DO NOTHING`), usa ids con prefijo `_seed_`
   (`u_seed_`, `p_seed_`, ...) y **se niega a correr si el host no es el de la rama de pruebas**. Es idempotente.

### Test de integración (reclamos y fotos)

`test/claims.integration.test.js` prueba contra un Postgres real el cambio de avatar con fotos de reclamo, la aceptación que rechaza al resto,
el límite de 3 intentos, la carrera de pedidos simultáneos, el vencimiento, el barrido de fotos sin usar y `GET /photos/:id`.
`npm test` lo saltea solo: **no corre si no se definen las dos variables** y nunca usa el `DATABASE_URL` de `backend/.env` (producción).

1. Usá una base **de pruebas** (una rama de Neon propia o un Postgres local), nunca producción ni Hallados-dev, y aplicale las migraciones 001 a 008.
2. Guardá en `backend/.env.test.local` (ignorado por git):
   ```
   DATABASE_URL=<la misma cadena de la base de pruebas, solo para correr migrate>
   TEST_DATABASE_URL=<cadena de la base de pruebas>
   TEST_DB_ALLOWED_HOST_PREFIX=<inicio del host, ej. ep-nombre o localhost>
   ```
3. Migrar esa base: `node --env-file=.env.test.local scripts/migrate.js` (verificá antes el host, sin imprimir la URL entera).
4. Correr: `node --env-file=.env.test.local --test test/claims.integration.test.js`.

Los datos llevan el prefijo `u_itest_`/`p_itest_` y se borran al terminar. El caso del barrido ejecuta `deleteOrphanClaimPhotos()`, que borra
**todas** las fotos de reclamo sin usar de más de 24 h de esa base: por eso solo debe correrse en una base de pruebas.

Alternativa local con Docker: `docker run --rm -d --name hallado-test -p 5433:5432 -e POSTGRES_PASSWORD=test postgres:16`
(cadena `postgresql://postgres:test@localhost:5433/postgres`, prefijo `localhost`).

### Base de desarrollo del equipo (Hallados-dev)

Existe un proyecto de Neon aparte de producción (`Hallados-dev`) para que el equipo pruebe endpoints sin riesgo.

- La URL de conexión se entrega por mensaje privado. Cada uno la guarda en su propio `backend/.env` o en un archivo `.env.<algo>.local`
  (ignorado por git). Nunca va al repo ni al chat grupal.
- Las migraciones (001 a 008) y los datos de ejemplo ya están cargados: **no hace falta correr `migrate` ni `seed`**.
- Si necesitás una migración nueva (009...), probala primero en tu propia rama de Neon y avisá al equipo.
- `scripts/seed_demo.js` toma el prefijo de host permitido de la variable `SEED_DEMO_ALLOWED_HOST_PREFIX`
  (obligatoria, sin valor por defecto: el prefijo del endpoint de la base de pruebas) y sale con error si falta o si el host no coincide.

### Lo que todavía no está hecho

- Ya tienen API: **reclamos** (punto 7, ver `API_CONTRACT.md`, sección "Reclamos"), más `GET /barrios` y la foto de reclamo (`POST /reclamos/foto`).
- La API (rutas y servicios) de publicaciones, puntos de encuentro, devoluciones, valoraciones por devolución, agradecimientos, alertas, seguidas y búsquedas: hoy solo existe el esquema.
- Los reclamos vencen a las 48 h con el reloj del servidor: `expireDueClaims` (`services/claims.js`) corre antes de cada lectura/decisión y cada 5 min desde `index.js`.
  Las rutas de publicaciones, cuando existan, deberían llamarla antes de leer estados si muestran reclamos.
- Las migraciones 002 a 008 **no se aplicaron a producción**, que tiene solo la 001.
- La pregunta y respuesta de verificación viven en `publications` (`verification_question`, `verification_answer`), no en una tabla aparte.

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
    routes/            auth.js, users.js, photos.js, claims.js, neighborhoods.js
    middleware/        auth (token), rateLimit, upload (fotos), errors
    services/          tokens, session, registration, passwordReset,
                       otp, otpStore, mailer, passwordRules,
                       profile, photos, photoUrl, reputation, publicProfile,
                       claims
  migrations/          001_init.sql ... 008_alerts_follows_searches.sql (esquema)
    rollback/          00N_*.down.sql (reversión manual, 002 a 008)
  scripts/
    migrate.js         aplica las migraciones pendientes
    seed.js            carga las cuentas de prueba (borra y reinserta, ver aviso)
    seed_demo.js       datos de ejemplo del esquema completo (solo en la rama de pruebas)
  test/                tests con node --test
  .env.example         plantilla de variables de entorno
```
