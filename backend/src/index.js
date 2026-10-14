const { PORT, TRUST_PROXY } = require('./config');

const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const { authLimiter, unauthLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

// Cantidad de proxies confiables delante del server (nunca `true`).
if (TRUST_PROXY > 0) app.set('trust proxy', TRUST_PROXY);

app.use(cors());
app.use(express.json({ limit: '10kb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authLimiter, authRouter);
app.use('/users', unauthLimiter, usersRouter);

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Hallado backend escuchando en puerto ${PORT}`);
  });
}

module.exports = app;
