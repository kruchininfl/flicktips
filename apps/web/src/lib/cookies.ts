// Browser cookies (js-cookie replacement) for the few non-HttpOnly cookies the site sets itself.
export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const pair of document.cookie.split('; ')) {
    const eq = pair.indexOf('=');
    if (eq > 0 && decodeURIComponent(pair.slice(0, eq)) === name) return decodeURIComponent(pair.slice(eq + 1));
  }
  return undefined;
}

export function setCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function removeCookie(name: string): void {
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

// Reads a cookie and removes it.
export function takeCookie(name: string): string | undefined {
  const value = getCookie(name);
  if (value !== undefined) removeCookie(name);
  return value;
}
