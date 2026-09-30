const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const prisma = require('./db');
const { errorHandler } = require('./middleware/common');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/people', require('./routes/people'));
app.use('/api/events', require('./routes/events'));
const { categories, notifications } = require('./routes/misc');
app.use('/api/categories', categories);
app.use('/api/notifications', notifications);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
