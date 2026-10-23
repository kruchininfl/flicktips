import type { FastifyInstance } from 'fastify';

import { HttpError } from './errors.js';

// Clients send Content-Type: application/json on bodiless requests too (PHP ignored an empty body); Fastify
// would answer those with 400. Register inside a route plugin: it applies to that plugin's routes only.
export function acceptEmptyJsonBody(app: FastifyInstance): void {
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const text = String(body).trim();
    if (!text) return done(null, undefined);
    try {
      done(null, JSON.parse(text));
    } catch {
      done(new HttpError(400, 'Invalid JSON body'));
    }
  });
}
