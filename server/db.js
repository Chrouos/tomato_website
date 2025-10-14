import { Pool } from 'pg';
import { getEnv, getEnvNumber, isEnvTrue } from './config/env.js';

const connectionOptions = {};

const databaseUrl = getEnv('DATABASE_URL');

if (databaseUrl) {
  connectionOptions.connectionString = databaseUrl;
} else {
  connectionOptions.host = getEnv('DB_HOST', 'localhost');
  connectionOptions.port = getEnvNumber('DB_PORT', 5432);
  connectionOptions.database = getEnv('DB_NAME', 'tomato');
  connectionOptions.user = getEnv('DB_USER', 'tomato_user');
  connectionOptions.password = getEnv('DB_PASSWORD', 'tomato_password');
}

if (isEnvTrue('DB_SSL')) {
  connectionOptions.ssl = {
    rejectUnauthorized: getEnv('DB_SSL_REJECT_UNAUTHORIZED', 'true') !== 'false',
  };
}

const pool = new Pool(connectionOptions);

pool.on('error', (err) => {
  console.error('Unexpected Postgres idle client error', err);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();

export default pool;
