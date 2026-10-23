// Connection settings from the environment. Secrets are read here and never printed: describeDb() is
// what the CLI logs.
import type { DbConfig } from '@flicktips/db';

export class ConfigError extends Error {}

export function dbConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DbConfig {
  // DB_NAME has no default on purpose: the database written to must be named explicitly
  const database = env.DB_NAME?.trim();
  if (!database) throw new ConfigError('DB_NAME is not set (flicktips_test or flicktips)');
  const port = Number(env.DB_PORT ?? 3306);
  if (!Number.isInteger(port) || port <= 0) throw new ConfigError('DB_PORT is not a port number');
  return {
    host: env.DB_HOST || '127.0.0.1',
    port,
    user: env.DB_USER || 'flicktips',
    password: env.DB_PASSWORD ?? '',
    database,
    connectionLimit: 4,
  };
}

export function kpApiKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const key = env.KP_API_KEY?.trim();
  if (!key) throw new ConfigError('KP_API_KEY is not set');
  return key;
}

export function describeDb(c: DbConfig): string {
  return `${c.user}@${c.host}:${c.port}/${c.database}${c.password ? ' (password set)' : ' (no password)'}`;
}
