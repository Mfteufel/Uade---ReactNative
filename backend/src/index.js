const { PORT, TRUST_PROXY } = require('./config');

const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const photosRouter = require('./routes/photos');
const { router: claimsRouter, publicationClaimsRouter } = require('./routes/claims');
const neighborhoodsRouter = require('./routes/neighborhoods');
const categoriesRouter = require('./routes/categories');
const searchRouter = require('./routes/search');
const recentSearchesRouter = require('./routes/recentSearches');
const historyRouter = require('./routes/history');
const { expireDueClaims } = require('./services/claims');
const { deleteOrphanClaimPhotos } = require('./services/photos');
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
app.use('/reclamos', unauthLimiter, claimsRouter);
app.use('/publicaciones/:publicationId/reclamos', unauthLimiter, publicationClaimsRouter);
app.use('/barrios', unauthLimiter, neighborhoodsRouter);
app.use('/categorias', unauthLimiter, categoriesRouter);
app.use('/publicaciones', searchRouter); // solo GET /; sus middlewares van en la ruta (ver routes/search.js)
app.use('/busquedas-recientes', unauthLimiter, recentSearchesRouter);
app.use('/historial', unauthLimiter, historyRouter);

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Hallado backend escuchando en puerto ${PORT}`);
  });
  server.requestTimeout = 60_000;

  // Los reclamos pendientes vencen a las 48 h aunque nadie los consulte: además de aplicar el vencimiento
  // en cada lectura, el servidor lo barre cada tanto con su propio reloj.
  const sweepClaims = () => expireDueClaims().catch((e) => console.error('[claims] no se pudo barrer vencimientos:', e.code || e.message));
  sweepClaims();
  setInterval(sweepClaims, 5 * 60 * 1000).unref();

  // Las fotos de reclamo que se subieron y nunca se usaron en un reclamo no deben quedar para siempre en la base.
  const sweepPhotos = () => deleteOrphanClaimPhotos().catch((e) => console.error('[photos] no se pudo barrer fotos sin usar:', e.code || e.message));
  sweepPhotos();
  setInterval(sweepPhotos, 60 * 60 * 1000).unref();
}

module.exports = app;
