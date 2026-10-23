import { createDb, type DbConfig } from '@flicktips/db';
import type { Pool, ResultSetHeader } from 'mysql2/promise';

import { env } from './env.js';

// chat ids are bigints below -2^53 for supergroups; keep them (and dates) as strings
export const poolOptions: NonNullable<DbConfig['poolOptions']> = {
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: true,
};

// Same DB choice as the API: APP_ENV=dev means flicktips_test.
export function loadDbConfig(): DbConfig {
  return {
    host: env('DB_HOST', '127.0.0.1'),
    port: Number(env('DB_PORT', '3306')),
    user: env('DB_USER', 'flicktips'),
    password: env('DB_PASSWORD'),
    database: env('DB_NAME', env('APP_ENV', 'prod') === 'dev' ? 'flicktips_test' : 'flicktips'),
    connectionLimit: 3,
    poolOptions,
  };
}

let pool: Pool | undefined;

/** Opens the shared pool (createDb from @flicktips/db) from the environment, or uses the given one (tests). */
export function openDb(existing?: Pool): Pool {
  pool = existing ?? createDb(loadDbConfig()).pool;
  return pool;
}

function getPool(): Pool {
  if (!pool) {
    throw new Error('Database is not open, call openDb() first');
  }
  return pool;
}

export async function select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

export async function selectOne<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await select<T>(sql, params))[0];
}

export async function exec(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await getPool().query(sql, params);
  return result as ResultSetHeader;
}

export function closeDb() {
  return getPool().end();
}
