import type { FastifyRequest } from 'fastify';

import { unauthorized } from '../lib/errors.js';

// The signed-in user making the request.
export interface Viewer {
  id: number;
  // session.id (hash) of the cookie that signed this request in; absent for resolvers that do not use sessions
  sessionId?: string;
}

export type ViewerResolver = (request: FastifyRequest) => Promise<Viewer | null>;

export function requireViewer(request: FastifyRequest): Viewer {
  if (!request.viewer) throw unauthorized();
  return request.viewer;
}

declare module 'fastify' {
  interface FastifyRequest {
    viewer: Viewer | null;
  }
}
