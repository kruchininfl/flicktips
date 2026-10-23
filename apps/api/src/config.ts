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
  };
}
