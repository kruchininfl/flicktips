// Keeps the legacy URLs exactly: /profile/* pages end with a slash, every other page has none. next.config sets
// skipTrailingSlashRedirect, so this is the only place that adds or strips the slash (308, like Next.js does).
import { NextResponse, type NextRequest } from 'next/server';

const WITH_SLASH = /^\/profile\/[^/]+$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let target: string | null = null;
  if (WITH_SLASH.test(pathname)) target = pathname + '/';
  else if (pathname.length > 1 && pathname.endsWith('/') && !pathname.startsWith('/profile/')) {
    target = pathname.replace(/\/+$/, '') || '/';
  }
  if (!target) return NextResponse.next();

  // a plain URL: NextURL re-applies the request's own trailing slash when serialized
  return NextResponse.redirect(new URL(target + request.nextUrl.search, request.url), 308);
}

export const config = {
  // pages only: not the API (proxied in dev), Next.js internals or static files
  matcher: ['/((?!api/|auth/|_next/|public/|poster/|favicon\\.ico).*)'],
};
