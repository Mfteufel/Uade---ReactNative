const { PORT, TRUST_PROXY } = require('./config');

const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const photosRouter = require('./routes/photos');
const { authLimiter, unauthLimiter, photosLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

// Cantidad de proxies confiables delante del server (nunca `true`).
if (TRUST_PROXY > 0) app.set('trust proxy', TRUST_PROXY);

app.use(cors());

// Log de pedidos solo en desarrollo: método, ruta (sin query), estado y tamaño declarado. Nunca cuerpos ni headers.
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    const size = req.headers['content-length'] ? `${req.headers['content-length']} bytes` : '-';
    res.once('finish', () => console.log(`[req] ${req.method} ${req.path} ${res.statusCode} (${size}, ${Date.now() - start} ms)`));
    res.once('close', () => {
      if (!res.writableFinished) console.log(`[req] ${req.method} ${req.path} CORTADO (${size}, ${Date.now() - start} ms)`);
    });
    next();
  });
}

app.use(express.json({ limit: '10kb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authLimiter, authRouter);
app.use('/users', unauthLimiter, usersRouter);
app.use('/photos', photosLimiter, photosRouter);

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Hallado backend escuchando en puerto ${PORT}`);
  });
  server.requestTimeout = 60_000;
}

module.exports = app;
