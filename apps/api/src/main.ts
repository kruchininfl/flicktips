import { createDb } from '@flicktips/db';

import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const { pool } = createDb(config.db);

const app = buildApp(
  {
    pingDb: async () => {
      await pool.query('SELECT 1');
      return true;
    },
  },
  { logger: true },
);

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ host: config.host, port: config.port });
