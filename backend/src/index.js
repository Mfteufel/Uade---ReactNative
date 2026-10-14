const { PORT } = require('./config');

const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Hallado backend escuchando en puerto ${PORT}`);
  });
}

module.exports = app;
