// Shared bits of the provider clients: form POSTs with a timeout and JSON answers.
import { OAuthError } from '../oauth.js';

export type FetchLike = typeof fetch;

const TIMEOUT_MS = 10_000;

export async function postForm(
  fetchImpl: FetchLike,
  url: string,
  fields: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  return requestJson(fetchImpl, url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', ...headers },
    body: new URLSearchParams(fields).toString(),
  });
}

export async function getJson(
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  return requestJson(fetchImpl, url, { method: 'GET', headers: { accept: 'application/json', ...headers } });
}

async function requestJson(fetchImpl: FetchLike, url: string, init: RequestInit): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw new OAuthError('provider', `${new URL(url).host}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new OAuthError('provider', `${new URL(url).host} answered ${response.status} with a non-JSON body`);
  }
  if (!data || typeof data !== 'object') {
    throw new OAuthError('provider', `${new URL(url).host} answered ${response.status} with an unexpected body`);
  }
  const body = data as Record<string, unknown>;
  if (!response.ok || typeof body.error === 'string') {
    const description = typeof body.error_description === 'string' ? `: ${body.error_description}` : '';
    throw new OAuthError(
      'provider',
      `${new URL(url).host} answered ${response.status} ${body.error ?? ''}${description}`,
    );
  }
  return body;
}

export const base64Url = (bytes: Buffer) => bytes.toString('base64url');

export function str(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}
