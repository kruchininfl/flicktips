// HMAC-signed JSON payloads with an expiry: the OAuth login cookie and the account-link proof. Port of the
// encoding used by the PHP Security\AccountLinkProof (base64url(payload).base64url(hmac-sha256)).
import { createHmac, timingSafeEqual } from 'node:crypto';

const base64Url = (data: Buffer | string) => Buffer.from(data).toString('base64url');

function hmac(payload: string, key: string): Buffer {
  return createHmac('sha256', key).update(payload).digest();
}

// `ttlSeconds` from now; `exp` is a unix timestamp inside the payload.
export function sign(data: Record<string, unknown>, key: string, ttlSeconds: number): string {
  const payload = base64Url(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${payload}.${base64Url(hmac(payload, key))}`;
}

// The payload (without `exp`) when the signature matches and it has not expired, otherwise null.
export function verify(token: unknown, key: string): Record<string, unknown> | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts as [string, string];
  const expected = hmac(payload, key);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const { exp, ...rest } = data as Record<string, unknown>;
  if (typeof exp !== 'number' || exp < Math.floor(Date.now() / 1000)) return null;
  return rest;
}

// Constant-time comparison of two short strings (OAuth state).
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
