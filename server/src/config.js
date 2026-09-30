require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('change-me'))) {
  throw new Error('JWT_SECRET must be set to a strong value in production');
}

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 4717,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5717',
};
