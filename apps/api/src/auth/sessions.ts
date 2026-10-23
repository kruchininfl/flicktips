// Login sessions (table `session`, migration 001): the cookie carries a random token, the table its SHA-256.
// Sliding expiry of a year, like the PHP cookie_lifetime; revoking a row logs that browser out at once.
import { createHash, randomBytes } from 'node:crypto';

import { schema, type Db } from '@flicktips/db';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';

import type { AppDeps } from '../deps.js';
import type { ViewerResolver } from './viewer.js';

const { session } = schema;

export const SESSION_COOKIE = 'ft_session';
export const SESSION_LIFETIME_SECONDS = 365 * 24 * 3600;
// last_seen_at / expires_at are pushed forward at most this often
export const SESSION_TOUCH_INTERVAL_SECONDS = 5 * 60;

type Executor = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

// SQL expressions, so the clock is always MySQL's (no JS ↔ DB timezone mix-ups).
const now = sql`NOW()`;
const expiry = sql`DATE_ADD(NOW(), INTERVAL ${sql.raw(String(SESSION_LIFETIME_SECONDS))} SECOND)`;

export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function cookieOptions(env: 'prod' | 'dev') {
  return {
    path: '/',
    httpOnly: true,
    secure: env === 'prod',
    sameSite: 'lax' as const,
    maxAge: SESSION_LIFETIME_SECONDS,
  };
}

// Creates a session for `userId` and returns the cookie token (the only time it exists in clear text).
export async function createSession(db: Executor, userId: number, userAgent: string | undefined): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.insert(session).values({
    id: hashSessionToken(token),
    userId,
    createdAt: now as unknown as Date,
    lastSeenAt: now as unknown as Date,
    expiresAt: expiry as unknown as Date,
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
  });
  return token;
}

export interface LiveSession {
  id: string;
  userId: number;
}

// The unexpired session behind a cookie token, touching last_seen_at / expires_at when they are stale.
export async function findSession(db: Executor, token: string): Promise<LiveSession | null> {
  const id = hashSessionToken(token);
  const [row] = await db
    .select({
      id: session.id,
      userId: session.userId,
      stale: sql<number>`${session.lastSeenAt} < DATE_SUB(NOW(), INTERVAL ${sql.raw(String(SESSION_TOUCH_INTERVAL_SECONDS))} SECOND)`,
    })
    .from(session)
    .where(and(eq(session.id, id), sql`${session.expiresAt} > NOW()`))
    .limit(1);
  if (!row) return null;
  if (Number(row.stale)) {
    await db
      .update(session)
      .set({ lastSeenAt: now as unknown as Date, expiresAt: expiry as unknown as Date })
      .where(eq(session.id, id));
  }
  return { id: row.id, userId: row.userId };
}

export async function revokeSession(db: Executor, id: string): Promise<void> {
  await db.delete(session).where(eq(session.id, id));
}

export async function revokeUserSessions(db: Executor, userId: number): Promise<void> {
  await db.delete(session).where(eq(session.userId, userId));
}

// Lazy cleanup, run on every login: logins are rare, so this is cheap enough.
export async function deleteExpiredSessions(db: Executor): Promise<void> {
  await db.delete(session).where(lt(session.expiresAt, now as unknown as Date));
}

// Reads the session cookie into request.viewer. Replaces the stage-3 legacy header resolver.
export function sessionResolver(deps: Pick<AppDeps, 'db'>): ViewerResolver {
  return async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return null;
    const live = await findSession(deps.db, token);
    return live ? { id: live.userId, sessionId: live.id } : null;
  };
}

export function setSessionCookie(reply: FastifyReply, token: string, env: 'prod' | 'dev') {
  reply.setCookie(SESSION_COOKIE, token, cookieOptions(env));
}

export function clearSessionCookie(reply: FastifyReply, env: 'prod' | 'dev') {
  reply.clearCookie(SESSION_COOKIE, { ...cookieOptions(env), maxAge: undefined });
}
