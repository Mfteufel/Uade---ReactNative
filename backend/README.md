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
| PUBLIC_URL      | URL pública del backend                       |
| NODE_ENV        | Entorno (development / production)            |
| TRUST_PROXY     | Cantidad de proxies delante del server (0 por defecto; para rate limit por IP) |
