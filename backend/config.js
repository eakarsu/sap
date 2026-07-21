const REQUIRED_SECRET_LENGTH = 32;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < REQUIRED_SECRET_LENGTH) {
  throw new Error(`JWT_SECRET must be at least ${REQUIRED_SECRET_LENGTH} characters`);
}
const port = Number(process.env.BACKEND_PORT || 4002);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('BACKEND_PORT must be a valid TCP port');
const nodeEnv = process.env.NODE_ENV || 'development';

module.exports = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,
  jwtIssuer: 'sap-crm-workbench',
  jwtAudience: 'sap-crm-web',
  corsOrigins: (nodeEnv === 'test' ? process.env.CORS_ORIGINS || 'http://127.0.0.1:3001' : required('CORS_ORIGINS')).split(',').map((value) => value.trim()).filter(Boolean),
  host: process.env.APP_HOST || '127.0.0.1',
  port,
};
