// Cross-site request forgery guard for the cookie sessions. The session cookie is SameSite=Lax, which already
// keeps it out of cross-site POSTs in current browsers; this check is the second line: a state-changing request
// must come from our own origin. Browsers always send `Origin` with cross-origin POST/PUT/PATCH/DELETE, and
// `Sec-Fetch-Site` on every request, so a request that carries neither comes from a non-browser client, where
// ambient cookies are not a concern.
import type { FastifyRequest } from 'fastify';

import { HttpError } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const crossSiteRejected = () => new HttpError(403, 'cross-site request rejected');

export function isSameOrigin(request: FastifyRequest, siteUrl: string): boolean {
  const origin = request.headers.origin;
  if (typeof origin === 'string') {
    // `null` is what browsers send from sandboxed/opaque origins and redirects: not us
    return origin === siteUrl;
  }
  const fetchSite = request.headers['sec-fetch-site'];
  if (typeof fetchSite === 'string') {
    return fetchSite === 'same-origin' || fetchSite === 'none';
  }
  return true;
}

export function assertSameOrigin(request: FastifyRequest, siteUrl: string): void {
  if (SAFE_METHODS.has(request.method)) return;
  if (!isSameOrigin(request, siteUrl)) throw crossSiteRejected();
}
