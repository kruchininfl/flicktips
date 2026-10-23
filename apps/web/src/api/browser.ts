// API client for Client Components: same-origin requests to /api (nginx in production, next.config rewrites in
// dev), the session cookie goes along by itself. Mutations must come from here: the API accepts them only from
// the site's own origin (apps/api/docs/auth.md, "CSRF").
import { parseResponse, requestInit, withQuery, type Transport } from './core';
import { createApi } from './endpoints';

// Fired on a 401 so the shell can open the sign-in popup (components/shell/UiProvider)
export const UNAUTHORIZED_EVENT = 'flicktips:unauthorized';

const browserTransport: Transport = async (path, options = {}) => {
  const response = await fetch(withQuery(path, options.query), {
    ...requestInit(options, {}),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (response.status === 401 && options.signInOn401 !== false && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  return parseResponse(response, path);
};

export const api = createApi(browserTransport);
