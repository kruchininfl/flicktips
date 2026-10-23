import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import * as schema from './schema/index.js';

export { schema };

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;
  /** Extra mysql2 pool options (e.g. supportBigNumbers, dateStrings); applied last. */
  poolOptions?: Partial<mysql.PoolOptions>;
}

export type Db = MySql2Database<typeof schema>;

export function createDb(config: DbConfig): { db: Db; pool: mysql.Pool } {
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: config.connectionLimit ?? 10,
    charset: 'utf8mb4',
    ...config.poolOptions,
  });
  return { db: drizzle(pool, { schema, mode: 'default' }), pool };
}
