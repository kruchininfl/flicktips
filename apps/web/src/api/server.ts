// API client for Server Components, generateMetadata and route handlers: calls the API directly (not through
// nginx) and forwards the visitor's cookies, so `ft_session` identifies the viewer as in the browser.
import 'server-only';

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { isApiError, parseResponse, requestInit, withQuery, type Transport } from './core';
import { createApi } from './endpoints';

export const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3002').replace(/\/$/, '');

const serverTransport: Transport = async (path, options = {}) => {
  const incoming = await headers();
  const forwarded: Record<string, string> = {};
  const cookie = incoming.get('cookie');
  if (cookie) forwarded.cookie = cookie;
  const userAgent = incoming.get('user-agent');
  if (userAgent) forwarded['user-agent'] = userAgent;

  const url = API_INTERNAL_URL + withQuery(path, options.query);
  const response = await fetch(url, { ...requestInit(options, forwarded), cache: 'no-store' });
  return parseResponse(response, path);
};

export const serverApi = createApi(serverTransport);

// Awaits an API call and turns its 404 into the Next.js not-found page (status 404), like the legacy SSR did.
export async function orNotFound<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (isApiError(error, 404)) notFound();
    throw error;
  }
}
