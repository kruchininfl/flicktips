// Secrets come from the environment (docker compose env_file: .env; see .env.example).
export function env(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value) {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Missing environment variable ${name}`);
}

export const SITE_URL = env('SITE_URL', 'https://flicktips.ru');
export const BOT_USERNAME = env('TELEGRAM_BOT_USERNAME', 'FlickTipsBot');
