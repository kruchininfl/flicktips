import api from 'api';
import Cookies from 'js-cookie';

// a guest who came from the Telegram bot keeps its code here until they sign in (see App)
export const TELEGRAM_COOKIE = 'ft_telegram';

// links the Telegram account from the bot's code to the current user; resolves with the joined group or null
export function confirmTelegram(code) {
  return (dispatch) => dispatch(api.confirmTelegram(code))
    .then((response) => response.body.group);
}

export function rememberTelegramCode(code) {
  Cookies.set(TELEGRAM_COOKIE, code, {expires: 1, path: '/'});
}

export function takeRememberedTelegramCode() {
  const code = Cookies.get(TELEGRAM_COOKIE);

  if (code) {
    Cookies.remove(TELEGRAM_COOKIE, {path: '/'});
  }

  return code;
}