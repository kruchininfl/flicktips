import { schema } from '@flicktips/db';
import { and, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';

import type { AppDeps } from '../deps.js';
import { unauthorized } from '../lib/errors.js';

// The signed-in user making the request.
export interface Viewer {
  id: number;
}

export type ViewerResolver = (request: FastifyRequest) => Promise<Viewer | null>;

// Stage 3: the legacy redux-oauth headers (uid + access-token), checked like
// UserRepository::getByCredentials. Stage 4 replaces this with the session cookie.
export function legacyTokenResolver(deps: Pick<AppDeps, 'db'>): ViewerResolver {
  return async (request) => {
    const uid = Number(request.headers['uid']);
    const token = request.headers['access-token'];
    if (!Number.isInteger(uid) || uid <= 0 || typeof token !== 'string' || !token) return null;
    const [row] = await deps.db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(and(eq(schema.user.id, uid), eq(schema.user.token, token)))
      .limit(1);
    return row ? { id: row.id } : null;
  };
}

export function requireViewer(request: FastifyRequest): Viewer {
  if (!request.viewer) throw unauthorized();
  return request.viewer;
}

declare module 'fastify' {
  interface FastifyRequest {
    viewer: Viewer | null;
  }
}
