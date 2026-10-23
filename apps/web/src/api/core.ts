// Transport-independent parts of the API client: request options, errors, response parsing.
import type { ApiErrorBody } from '@flicktips/shared';

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Query;
  // sent as JSON
  body?: unknown;
  signal?: AbortSignal;
  // browser only: a 401 opens the sign-in popup unless this is false (legacy `skipAuthCheck`)
  signInOn401?: boolean;
}

// A transport fetches `path` (starting with /api or /auth) and resolves with the parsed JSON body.
export type Transport = <T>(path: string, options?: RequestOptions) => Promise<T>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null,
    readonly path: string,
  ) {
    super(body?.msg ?? body?.err ?? `API ${status} on ${path}`);
    this.name = 'ApiError';
  }
}

export const isApiError = (error: unknown, status?: number): error is ApiError =>
  error instanceof ApiError && (status === undefined || error.status === status);

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function requestInit(options: RequestOptions, headers: Record<string, string>): RequestInit {
  const init: RequestInit = { method: options.method ?? 'GET', headers: { accept: 'application/json', ...headers } };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  if (options.signal) init.signal = options.signal;
  return init;
}

export async function parseResponse<T>(response: Response, path: string): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) throw new ApiError(response.status, body as ApiErrorBody | null, path);
  return body as T;
}
