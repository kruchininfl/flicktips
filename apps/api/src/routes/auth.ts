// Sign-in with VK ID / Yandex ID, sessions and linked accounts. Replaces the PHP security layer
// (api/app/services.php, src/Security/*, src/Listeners/*) and UserController::validateToken / linkAccount /
// mergeAccount / unlinkAccount. Flows, cookies and differences from PHP: apps/api/docs/auth.md.
import { randomBytes } from 'node:crypto';

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { isLoginService, OAuthError, type LoginService, type OAuthIdentity } from '../auth/oauth.js';
import {
  clearSessionCookie,
  createSession,
  deleteExpiredSessions,
  revokeSession,
  revokeUserSessions,
  setSessionCookie,
} from '../auth/sessions.js';
import { safeEqual, sign, verify } from '../auth/signed.js';
import { requireViewer, type Viewer } from '../auth/viewer.js';
import type { AppDeps } from '../deps.js';
import { badRequest, HttpError, notFound, unauthorized } from '../lib/errors.js';
import { acceptEmptyJsonBody } from '../lib/json-body.js';
import * as accounts from '../repositories/accounts.js';
import { getLoginServices, getViewerProfile } from '../repositories/users.js';

// Cookie that carries the login flow between /auth/:provider and its callback (PHP kept this in the session).
export const OAUTH_COOKIE = 'ft_oauth';
const OAUTH_COOKIE_TTL_SECONDS = 10 * 60;
// A link proof (AccountLinkProof::TTL) lives this long.
export const LINK_PROOF_TTL_SECONDS = 15 * 60;
// Where a failed sign-in lands (the legacy sign-in page), with ?error=
export const SIGN_IN_PATH = '/signin';

interface LoginFlow {
  // provider
  p: LoginService;
  // state
  s: string;
  // next: validated relative path
  n: string;
  // link mode: id of the signed-in user who started it
  u: number | null;
}

/**
 * A relative path on our site, or null. Only `/path?query#hash` is accepted: no scheme, no `//host`, no
 * backslashes or control characters, so a redirect can never leave the site.
 */
export function validateNext(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  return value;
}

function appendQuery(path: string, params: Record<string, string>): string {
  const [base, hash] = path.split('#', 2) as [string, string?];
  const query = new URLSearchParams(params).toString();
  return `${base}${base.includes('?') ? '&' : '?'}${query}${hash !== undefined ? `#${hash}` : ''}`;
}

// The callback query as a flat string map (VK ID's SDK flow puts code/state/device_id inside `payload`).
function callbackQuery(raw: unknown): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    if (typeof value === 'string') query[key] = value;
  }
  if (typeof query.payload === 'string') {
    try {
      const payload = JSON.parse(query.payload) as Record<string, unknown>;
      for (const key of ['code', 'state', 'device_id']) {
        if (typeof payload[key] === 'string') query[key] = payload[key] as string;
      }
    } catch {
      // the provider sees to it
    }
  }
  return query;
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data ?? {});
  if (!result.success) throw badRequest(result.error.issues.map((i) => i.message).join('; '));
  return result.data;
}

export const authRoutes =
  (deps: AppDeps): FastifyPluginAsync =>
  async (app) => {
    const { db, config } = deps;
    acceptEmptyJsonBody(app);

    const flowCookieOptions = {
      path: '/auth',
      httpOnly: true,
      secure: config.env === 'prod',
      sameSite: 'lax' as const,
      maxAge: OAUTH_COOKIE_TTL_SECONDS,
    };
    const redirectUri = (provider: LoginService) => `${config.siteUrl}/auth/${provider}/callback`;

    function providerOf(request: FastifyRequest<{ Params: { provider: string } }>): LoginService {
      const { provider } = request.params;
      if (!isLoginService(provider)) throw notFound();
      return provider;
    }

    // GET /auth/:provider?next=/path&link=1 — starts sign-in (or, with link=1, linking to the signed-in user)
    app.get<{ Params: { provider: string }; Querystring: Record<string, unknown> }>(
      '/auth/:provider',
      async (request, reply) => {
        const provider = providerOf(request);
        const next = validateNext(request.query.next) ?? '/';
        const link = request.query.link === '1' || request.query.link === 'true';
        if (link && !request.viewer) {
          return reply.redirect(appendQuery(SIGN_IN_PATH, { next }), 302);
        }
        const flow: LoginFlow = {
          p: provider,
          s: randomBytes(24).toString('hex'),
          n: next,
          u: link ? request.viewer!.id : null,
        };
        reply.setCookie(
          OAUTH_COOKIE,
          sign({ ...flow }, config.authSecret, OAUTH_COOKIE_TTL_SECONDS),
          flowCookieOptions,
        );
        return reply.redirect(
          deps.oauth[provider].authorizationUrl({ state: flow.s, redirectUri: redirectUri(provider) }),
          302,
        );
      },
    );

    // GET /auth/:provider/callback — the provider sends the browser back here
    app.get<{ Params: { provider: string }; Querystring: Record<string, unknown> }>(
      '/auth/:provider/callback',
      async (request, reply) => {
        const provider = providerOf(request);
        const flow = verify(request.cookies[OAUTH_COOKIE], config.authSecret) as unknown as LoginFlow | null;
        reply.clearCookie(OAUTH_COOKIE, { ...flowCookieOptions, maxAge: undefined });

        const linking = !!flow?.u;
        const next = flow?.n ?? '/';
        const fail = (error: string) =>
          reply.redirect(
            linking ? appendQuery(next, { link_error: error }) : appendQuery(SIGN_IN_PATH, { error, next }),
            302,
          );

        if (!flow || flow.p !== provider) return fail('state');
        const query = callbackQuery(request.query);
        if (query.error) return fail(query.error === 'access_denied' ? 'denied' : 'provider');
        if (!query.state || !safeEqual(query.state, flow.s)) return fail('state');

        let identity: OAuthIdentity;
        try {
          identity = await deps.oauth[provider].fetchIdentity({
            query,
            state: flow.s,
            redirectUri: redirectUri(provider),
          });
        } catch (error) {
          if (!(error instanceof OAuthError)) throw error;
          request.log.warn({ provider, err: error }, 'sign-in failed');
          return fail(error.code);
        }

        if (linking) {
          // never create or sign in a user here: the identity goes back to the page as a signed proof
          const viewer = request.viewer;
          if (!viewer?.sessionId || viewer.id !== flow.u) return fail('session');
          const proof = sign(
            { service: provider, identity, sid: viewer.sessionId },
            config.authSecret,
            LINK_PROOF_TTL_SECONDS,
          );
          return reply.redirect(appendQuery(next, { link_proof: proof }), 302);
        }

        await deleteExpiredSessions(db);
        const userId = await accounts.findOrCreateUser(db, provider, identity);
        // signing in again from a signed-in browser replaces its session
        if (request.viewer?.sessionId) await revokeSession(db, request.viewer.sessionId);
        const token = await createSession(db, userId, request.headers['user-agent']);
        setSessionCookie(reply, token, config.env);
        return reply.redirect(next, 302);
      },
    );

    // POST /api/auth/logout — revokes the current session (always succeeds, signed in or not)
    app.post('/api/auth/logout', async (request, reply) => {
      if (request.viewer?.sessionId) await revokeSession(db, request.viewer.sessionId);
      clearSessionCookie(reply, config.env);
      return { success: true };
    });

    // POST /api/auth/logout-all — revokes every session of the signed-in user
    app.post('/api/auth/logout-all', async (request, reply) => {
      const viewer = requireViewer(request);
      await revokeUserSessions(db, viewer.id);
      clearSessionCookie(reply, config.env);
      return { success: true };
    });

    // DELETE /api/me — v2 settings «Удалить аккаунт»: the user and all their data, then signs out. The body must
    // say {confirm: 'delete'} so that a stray request cannot do it.
    app.delete('/api/me', async (request, reply) => {
      const viewer = requireViewer(request);
      const { confirm } = (request.body ?? {}) as { confirm?: unknown };
      if (confirm !== 'delete') throw badRequest('confirm: delete expected');
      if (!(await accounts.deleteUser(db, viewer.id))) throw unauthorized();
      clearSessionCookie(reply, config.env);
      return { success: true };
    });

    // GET /api/me — UserController::validateToken (GET /api/checkUser/): the signed-in user's profile
    app.get('/api/me', async (request) => {
      const viewer = requireViewer(request);
      const data = await getViewerProfile(db, viewer.id);
      if (!data) throw unauthorized();
      return { success: true, data };
    });

    // The identity behind a link proof, if it was issued to this very session (AccountLinkProof::verify).
    function verifyLinkProof(viewer: Viewer, proof: unknown): { service: LoginService; identity: OAuthIdentity } {
      const data = verify(proof, config.authSecret);
      const service = data?.service;
      const identity = data?.identity as OAuthIdentity | undefined;
      if (
        !data ||
        !isLoginService(service) ||
        !identity ||
        typeof identity.id !== 'string' ||
        !viewer.sessionId ||
        data.sid !== viewer.sessionId
      ) {
        throw badRequest('sign-in expired, try again');
      }
      return { service, identity };
    }

    const proofBody = z.object({ proof: z.string({ error: 'proof is required' }) });

    // UserController::linkAccount — POST /api/user/accounts/link/ {proof}
    app.post('/api/me/accounts/link', async (request) => {
      const viewer = requireViewer(request);
      const { service, identity } = verifyLinkProof(viewer, parse(proofBody, request.body).proof);
      const ownerId = await accounts.findIdByService(db, service, identity.id);

      if (ownerId !== null && ownerId !== viewer.id) {
        // the page asks whether to merge and calls /merge with the same proof
        return {
          success: true,
          status: 'conflict',
          service,
          merge: await accounts.getMergeSummary(db, viewer.id, ownerId),
        };
      }
      if (ownerId === null && !(await accounts.linkService(db, viewer.id, service, identity))) {
        throw new HttpError(409, 'another account of this service is already linked');
      }
      return { success: true, status: 'linked', service, services: await getLoginServices(db, viewer.id) };
    });

    // UserController::mergeAccount — POST /api/user/accounts/merge/ {proof}
    app.post('/api/me/accounts/merge', async (request) => {
      const viewer = requireViewer(request);
      const { service, identity } = verifyLinkProof(viewer, parse(proofBody, request.body).proof);
      const ownerId = await accounts.findIdByService(db, service, identity.id);
      if (ownerId === null || ownerId === viewer.id) throw new HttpError(409, 'nothing to merge');
      if (!(await accounts.mergeInto(db, viewer.id, ownerId))) throw new HttpError(409, 'accounts cannot be merged');
      return { success: true, status: 'merged', service, services: await getLoginServices(db, viewer.id) };
    });

    // UserController::unlinkAccount — POST /api/user/accounts/unlink/ {service}
    app.post('/api/me/accounts/unlink', async (request) => {
      const viewer = requireViewer(request);
      const service = ((request.body ?? {}) as Record<string, unknown>).service;
      if (!isLoginService(service)) throw badRequest('unknown service');
      if (!(await accounts.unlinkService(db, viewer.id, service))) {
        throw new HttpError(409, 'cannot unlink the last sign-in method');
      }
      return { success: true, services: await getLoginServices(db, viewer.id) };
    });
  };
