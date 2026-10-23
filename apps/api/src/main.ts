import { createDb } from '@flicktips/db';
import { KinopoiskClient } from '@flicktips/kinopoisk';

import { buildApp } from './app.js';
import { VkIdProvider } from './auth/providers/vk-id.js';
import { YandexProvider } from './auth/providers/yandex.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const { db, pool } = createDb(config.db);

const app = buildApp(
  {
    db,
    kp: new KinopoiskClient({ apiKey: config.kpApiKey }),
    oauth: {
      vkontakte: new VkIdProvider(config.oauth.vkontakte),
      yandex: new YandexProvider(config.oauth.yandex),
    },
    config,
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
