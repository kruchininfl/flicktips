// Codes a guest brings from an invite link (/invite/:code) or from the Telegram bot (/telegram?code=) are kept in
// cookies until they sign in; the shell then applies them (components/shell/PendingActions). Same cookie names
// as the legacy site.
import { setCookie, takeCookie } from './cookies';

export const INVITE_COOKIE = 'ft_invite';
export const TELEGRAM_COOKIE = 'ft_telegram';

export function rememberInvite(code: string): void {
  setCookie(INVITE_COOKIE, code, 7);
}

export function takeRememberedInvite(): string | undefined {
  return takeCookie(INVITE_COOKIE);
}

export function rememberTelegramCode(code: string): void {
  setCookie(TELEGRAM_COOKIE, code, 1);
}

export function takeRememberedTelegramCode(): string | undefined {
  return takeCookie(TELEGRAM_COOKIE);
}
