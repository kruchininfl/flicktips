import mysql, {ResultSetHeader} from 'mysql2/promise';
import {env} from './env';

// Same DB choice as the API: APP_ENV=dev means flicktips_test.
const pool = mysql.createPool({
  host: env('DB_HOST', '127.0.0.1'),
  port: Number(env('DB_PORT', '3306')),
  user: env('DB_USER', 'flicktips'),
  password: env('DB_PASSWORD'),
  database: env('DB_NAME', env('APP_ENV', 'prod') === 'dev' ? 'flicktips_test' : 'flicktips'),
  charset: 'utf8mb4',
  connectionLimit: 3,
  // chat ids are bigints below -2^53 for supergroups; keep them (and dates) as strings
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: true,
});

export async function select<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function selectOne<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return (await select<T>(sql, params))[0];
}

export async function exec(sql: string, params: any[] = []): Promise<ResultSetHeader> {
  const [result] = await pool.query(sql, params);
  return result as ResultSetHeader;
}

export function closeDb() {
  return pool.end();
}
