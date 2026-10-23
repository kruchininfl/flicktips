import { createHash } from 'node:crypto';

import { z } from 'zod';

// Same DB choice as the PHP API and tg-bot: APP_ENV=dev means flicktips_test.
const envSchema = z.object({
  APP_ENV: z.enum(['prod', 'dev']).default('prod'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().positive().default(3002),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().default(''),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().optional(),
  KP_API_KEY: z.string().default(''),
  TELEGRAM_BOT_USERNAME: z.string().default('FlickTipsBot'),
  // Public origin of the site (scheme + host, no path); OAuth redirect URIs and the CSRF origin check use it.
  SITE_URL: z.string().url().default('https://flicktips.ru'),
  // VK ID app: its ID and a random string used to derive PKCE verifiers (the app is a public client).
  VKONTAKTE_API_KEY: z.string().default(''),
  VKONTAKTE_API_SECRET: z.string().default(''),
  // Yandex ID app: ClientID and Client secret.
  YANDEX_CLIENT_ID: z.string().default(''),
  YANDEX_CLIENT_SECRET: z.string().default(''),
  // Optional: key for signing the OAuth state cookie and account-link proofs. Derived from the OAuth secrets
  // when empty, as the PHP AccountLinkProof did, so no new secret is needed.
  AUTH_SECRET: z.string().default(''),
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.parse(env);
  return {
    env: parsed.APP_ENV,
    host: parsed.API_HOST,
    port: parsed.API_PORT,
    db: {
      host: parsed.DB_HOST,
      port: parsed.DB_PORT,
      user: parsed.DB_USER,
      password: parsed.DB_PASSWORD,
      database: parsed.DB_NAME ?? (parsed.APP_ENV === 'dev' ? 'flicktips_test' : 'flicktips'),
    },
    kpApiKey: parsed.KP_API_KEY,
    telegramBotUsername: parsed.TELEGRAM_BOT_USERNAME,
    siteUrl: new URL(parsed.SITE_URL).origin,
    authSecret:
      parsed.AUTH_SECRET ||
      createHash('sha256')
        .update(`flicktips-auth|${parsed.VKONTAKTE_API_SECRET}|${parsed.YANDEX_CLIENT_SECRET}`)
        .digest('hex'),
    oauth: {
      vkontakte: { clientId: parsed.VKONTAKTE_API_KEY, secret: parsed.VKONTAKTE_API_SECRET },
      yandex: { clientId: parsed.YANDEX_CLIENT_ID, secret: parsed.YANDEX_CLIENT_SECRET },
    },
  };
}
