import { config as loadEnv } from 'dotenv';

const localEnvPath = process.env.DOTENV_PATH ?? '.env.local';
loadEnv({ path: localEnvPath, override: true });
loadEnv();

export const env = process.env;

export const getEnv = (key, defaultValue) => env[key] ?? defaultValue;

export const getEnvNumber = (key, defaultValue) => {
  const value = getEnv(key);
  const fallback =
    typeof defaultValue === 'number' ? defaultValue : Number.parseInt(defaultValue ?? '0', 10);

  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? fallback : parsed;
};

export const isEnvTrue = (key, defaultValue = false) => {
  const value = getEnv(key);

  if (value === undefined) {
    return defaultValue;
  }

  return value.toLowerCase() === 'true';
};

export default env;
