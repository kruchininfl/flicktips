import { getCookie, setCookie } from './cookies';

// The visitor's choice of colour theme; without the cookie the site follows the system (styles/theme.scss).
export const THEME_COOKIE = 'theme';
export type Theme = 'light' | 'dark';

// The collapsed desktop sidebar («Сайдбар свёрнутый»), remembered between visits.
export const SIDEBAR_COOKIE = 'sidebar';

export function parseTheme(value: string | undefined): Theme | undefined {
  return value === 'light' || value === 'dark' ? value : undefined;
}

export function currentTheme(): Theme {
  const chosen = parseTheme(document.documentElement.dataset.theme ?? getCookie(THEME_COOKIE));
  if (chosen) return chosen;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  setCookie(THEME_COOKIE, next, 365);
  return next;
}
