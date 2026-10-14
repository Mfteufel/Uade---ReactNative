# Hallado backend

API REST en Express para la app Hallado (autenticación, perfiles y reputación).

## Cómo correr

```bash
cd backend
cp .env.example .env   # completar los valores
npm install
npm run dev            # desarrollo, con recarga automática
npm start              # producción
npm test
```

Health check: `GET /health` responde `{"status":"ok"}`.

## Variables de entorno

| Variable        | Descripción                                   |
| --------------- | --------------------------------------------- |
| PORT            | Puerto HTTP (por defecto 3000)                |
| DATABASE_URL    | Cadena de conexión a PostgreSQL               |
| JWT_SECRET      | Secreto para firmar los tokens JWT            |
| BREVO_API_KEY   | API key de Brevo para envío de mails          |
| MAIL_FROM       | Dirección remitente de los mails              |
| PUBLIC_URL      | URL pública del backend, sin path (base de photoUri). Obligatoria y https en producción; en desarrollo por defecto http://localhost:PORT |
| NODE_ENV        | Entorno (development / production)            |
| TRUST_PROXY     | Cantidad de proxies delante del server (0 por defecto; para rate limit por IP) |

### PUBLIC_URL (fotos de perfil)

`photoUri` se arma como `${PUBLIC_URL}/photos/<uuid>` y debe ser alcanzable desde el dispositivo; tiene que coincidir con `EXPO_PUBLIC_API_URL` de la app. Sin path, query ni hash. Nunca se deriva de los headers de la request.

- Celular por USB: `adb reverse tcp:3000 tcp:3000` y `PUBLIC_URL=http://localhost:3000`
- Emulador Android: `PUBLIC_URL=http://10.0.2.2:3000`
- Red local (LAN): `PUBLIC_URL=http://192.168.x.y:3000`
- Producción: `https://tu-dominio` (obligatoria)
