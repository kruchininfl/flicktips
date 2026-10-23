import type { LoginService } from '@flicktips/shared';

export const SIGN_IN_PROVIDERS: readonly LoginService[] = ['vkontakte', 'yandex'];

// `next` must be a path on this site; anything else falls back to the home page (the API checks it again).
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/';
}

// Starts the OAuth flow; must be a full-page navigation (<a href>, not next/link), see apps/api/docs/auth.md.
export function signInUrl(provider: LoginService, next: string, link = false): string {
  const params = new URLSearchParams({ next: safeNext(next) });
  if (link) params.set('link', '1');
  return `/auth/${provider}?${params}`;
}

export function signInPageUrl(next: string): string {
  return '/signin?' + new URLSearchParams({ next: safeNext(next) });
}
