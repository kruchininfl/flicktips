// The signed-in user on the server side (Server Components, generateMetadata, route handlers).
import 'server-only';

import { redirect, unstable_rethrow } from 'next/navigation';
import { cache } from 'react';

import type { ViewerProfile } from '@flicktips/shared';

import { serverApi } from '@/api/server';
import { isApiError } from '@/api/core';

import { signInPageUrl } from './urls';

/**
 * GET /api/me with the visitor's cookies; null for anonymous visitors. Deduplicated per request, so the
 * layout, the page and generateMetadata can all call it. When the API is unreachable the page renders as
 * anonymous instead of failing.
 */
export const getViewer = cache(async (): Promise<ViewerProfile | null> => {
  try {
    return (await serverApi.me.get()).data;
  } catch (error) {
    // Next.js control flow (dynamic rendering, redirects) must pass through
    unstable_rethrow(error);
    if (!isApiError(error, 401)) console.error('getViewer: /api/me failed', error);
    return null;
  }
});

/**
 * The legacy `requireAuth` of the /profile/* routes: the viewer, or a redirect to /signin?next=<path>.
 * Call it at the top of the page with the page's own path (Next.js gives pages no request URL).
 */
export async function requireViewer(path: string): Promise<ViewerProfile> {
  const viewer = await getViewer();
  if (!viewer) redirect(signInPageUrl(path));
  return viewer;
}
