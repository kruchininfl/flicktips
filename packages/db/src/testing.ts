// Throwaway MySQL databases for integration tests: the legacy schema (test/legacy-schema.sql)
// plus every v2 migration, created on the server named by TEST_DB_* (CI: a mysql:8.4 service).
import { randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import mysql from 'mysql2/promise';

import { createDb, type Db } from './index.js';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

export interface TestDatabase {
  name: string;
  db: Db;
  pool: mysql.Pool;
  drop: () => Promise<void>;
}

export function testDbServer() {
  const host = process.env.TEST_DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.TEST_DB_PORT ?? 3306),
    user: process.env.TEST_DB_USER ?? 'root',
    password: process.env.TEST_DB_PASSWORD ?? '',
  };
}

async function sqlStatements(file: string): Promise<string[]> {
  const text = await readFile(file, 'utf8');
  return text
    .split(/--> statement-breakpoint|;\s*$/m)
    .map((s) =>
      s
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter(Boolean);
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const server = testDbServer();
  if (!server) throw new Error('TEST_DB_HOST is not set');

  const name = `ft_test_${randomBytes(4).toString('hex')}`;
  const admin = await mysql.createConnection({ ...server, multipleStatements: false });
  try {
    await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
    await admin.query(`USE \`${name}\``);
    // the legacy schema has '0000-00-00' date defaults, which strict modes reject
    await admin.query(`SET SESSION sql_mode = ''`);
    for (const statement of await sqlStatements(`${packageRoot}/test/legacy-schema.sql`)) {
      await admin.query(statement);
    }
    const migrations = (await readdir(`${packageRoot}/migrations`)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of migrations) {
      for (const statement of await sqlStatements(`${packageRoot}/migrations/${file}`)) {
        await admin.query(statement);
      }
    }
  } finally {
    await admin.end();
  }

  const { db, pool } = createDb({ ...server, database: name, connectionLimit: 4 });
  return {
    name,
    db,
    pool,
    drop: async () => {
      await pool.end();
      const conn = await mysql.createConnection(server);
      await conn.query(`DROP DATABASE IF EXISTS \`${name}\``);
      await conn.end();
    },
  };
}
