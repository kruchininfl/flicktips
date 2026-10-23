import type { ViewerProfile } from '@flicktips/shared';

// the Telegram bot is tried out by the site owner first; everyone else sees «Скоро»
const TELEGRAM_USER_IDS = [1];

export function canUseTelegram(viewer: ViewerProfile | null): boolean {
  return !!viewer && TELEGRAM_USER_IDS.includes(Number(viewer.id));
}
