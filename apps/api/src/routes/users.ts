// Users, follows, votes, bookmarks and invites: port of api/src/Controllers/UserController.php (without the
// sign-in parts). Old → new paths and every difference: apps/api/docs/routes-users.md.
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { requireViewer } from '../auth/viewer.js';
import type { AppDeps } from '../deps.js';
import { badRequest, HttpError, notFound } from '../lib/errors.js';
import {
  BOOKMARKS_LIST_SIZE,
  FRIENDS_LIST_SIZE,
  FRIENDS_VOTES_LIST_SIZE,
  USERS_RECOMMENDATIONS_SIZE,
  USERS_SEARCH_SIZE,
} from '../lib/limits.js';
import { countBookmarks, listBookmarks, toggleBookmark } from '../repositories/bookmarks.js';
import * as users from '../repositories/users.js';
import { countFriendsVotes, listFriendsVotes, queueVoteEvent, toggleVote, VOTE_VALUES } from '../repositories/votes.js';

// Largest page size a client may ask for (PHP had no limit).
const MAX_PAGE_SIZE = 100;

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw badRequest(
      result.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ` : '') + i.message).join('; '),
    );
  }
  return result.data;
}

// A positive integer id, as a JSON number or a numeric string.
const id = z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]);

// page / size: PHP used `$request->get('page') ?: default`, so missing, '' and 0 mean the default.
const pageNumber = z
  .union([z.literal(''), z.coerce.number().int().min(0)])
  .optional()
  .transform((v) => (v ? v : undefined));

const pagingQuery = z.object({ page: pageNumber, size: pageNumber.pipe(z.number().max(MAX_PAGE_SIZE).optional()) });

// 1/0, "1"/"0" or a boolean, as the legacy pages send flags
const flag = z.union([z.boolean(), z.literal(0), z.literal(1), z.literal('0'), z.literal('1')]).transform((v) => !!+v);

function paging(query: unknown, defaultSize: number) {
  const { page = 1, size = defaultSize } = parse(pagingQuery, query);
  return { page, size, offset: (page - 1) * size };
}

const pageResult = <T>(total: number, page: number, size: number, entities: T[]) => ({
  success: true,
  results: { total, page, pages: Math.ceil(total / size), entities },
});

// PHP trim(): only ASCII whitespace and NUL
const PHP_TRIM_CHARS = ' \t\n\r\0\v';
function phpTrim(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && PHP_TRIM_CHARS.includes(s[start]!)) start++;
  while (end > start && PHP_TRIM_CHARS.includes(s[end - 1]!)) end--;
  return s.slice(start, end);
}

export const userRoutes =
  (deps: AppDeps): FastifyPluginAsync =>
  async (app) => {
    const { db } = deps;

    // UserController::searchUsers — GET /api/users/search/?q=
    app.get('/users/search', async (request) => {
      const viewer = request.viewer;
      const raw = (request.query as Record<string, unknown>).q;
      const query = [...phpTrim(typeof raw === 'string' ? raw : '')];
      if (query.length < 2) return { success: true, results: [] };
      return {
        success: true,
        results: await users.searchUsers(db, query.slice(0, 64).join(''), viewer?.id ?? 0, USERS_SEARCH_SIZE),
      };
    });

    // UserController::getUser — GET /api/user/{uid}
    app.get<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
      const user = /^\d+$/.test(request.params.id) ? await users.findPublicUser(db, Number(request.params.id)) : null;
      if (!user) return reply.status(404).send({ success: false, err: 'User not found' });
      const viewer = request.viewer;
      if (viewer && viewer.id !== user.id) {
        return { success: true, user: { ...user, ...(await users.getRelation(db, viewer.id, user.id)) } };
      }
      return { success: true, user };
    });

    // UserController::getInvite — GET /api/invite/{code}
    app.get<{ Params: { code: string } }>('/invites/:code', async (request, reply) => {
      const inviter = await users.findByInviteCode(db, request.params.code);
      if (!inviter) return reply.status(404).send({ success: false, err: 'Invite not found' });
      return { success: true, user: inviter };
    });

    // UserController::updateUser — PUT /api/user/ {data: {hide_viewed}}
    app.patch('/me', async (request) => {
      const viewer = requireViewer(request);
      const { data } = parse(z.object({ data: z.object({ hide_viewed: flag.nullish() }).nullish() }), request.body);
      if (data?.hide_viewed !== undefined && data.hide_viewed !== null) {
        await users.setHideViewed(db, viewer.id, data.hide_viewed ? 1 : 0);
      }
      return { success: true, data: await users.getViewerProfile(db, viewer.id) };
    });

    // UserController::getFriends — GET /api/user/friends/?page&size&type=following|followers
    app.get('/me/friends', async (request) => {
      const viewer = requireViewer(request);
      const { page, size, offset } = paging(request.query, FRIENDS_LIST_SIZE);
      const type = (request.query as Record<string, unknown>).type === 'followers' ? 'followers' : 'following';
      const total = await users.countFriends(db, viewer.id, type);
      const entities = total ? await users.listFriends(db, viewer.id, type, size, offset) : [];
      return pageResult(total, page, size, entities);
    });

    // UserController::getFriendsVotes — GET /api/user/friends_votes/?page&size
    app.get('/me/friends/votes', async (request) => {
      const viewer = requireViewer(request);
      const { page, size } = paging(request.query, FRIENDS_VOTES_LIST_SIZE);
      const total = await countFriendsVotes(db, viewer.id);
      if (!total) return pageResult(total, page, size, []);
      // like PHP: page N returns everything from the first vote up to the end of page N
      const entities = await listFriendsVotes(db, viewer.id, size * page, 0);
      await users.markNotificationsSeen(db, viewer.id);
      return pageResult(total, page, size, entities);
    });

    // UserController::getBookmarks — GET /api/user/bookmarks/?page&size
    app.get('/me/bookmarks', async (request) => {
      const viewer = requireViewer(request);
      const { page, size, offset } = paging(request.query, BOOKMARKS_LIST_SIZE);
      const total = await countBookmarks(db, viewer.id);
      const entities = total ? await listBookmarks(db, viewer.id, size, offset) : [];
      return pageResult(total, page, size, entities);
    });

    // UserController::toggleVote — POST /api/user/vote/ {id, vote}
    app.post('/me/votes', async (request, reply) => {
      const viewer = requireViewer(request);
      const body = parse(
        z.object({ id, vote: z.enum(Object.keys(VOTE_VALUES) as [keyof typeof VOTE_VALUES]) }),
        request.body,
      );
      let outcome;
      try {
        outcome = await toggleVote(db, viewer.id, body.id, VOTE_VALUES[body.vote]);
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ success: false, msg: 'something went wrong' });
      }
      if (!outcome) throw notFound('Movie not found');

      // for the Telegram bot (tg-bot); a failure there must not fail the vote itself
      try {
        await queueVoteEvent(db, viewer.id, body.id, outcome.vote);
      } catch (error) {
        request.log.error(error, 'telegram vote_event');
      }
      return { success: true, data: outcome.result };
    });

    // UserController::toggleBookmark — POST /api/user/toggle_bookmark/ {movieId}
    app.post('/me/bookmarks/toggle', async (request) => {
      const viewer = requireViewer(request);
      const { movieId } = parse(z.object({ movieId: id }), request.body);
      const inBookmarks = await toggleBookmark(db, viewer.id, movieId);
      if (inBookmarks === null) throw notFound('Movie not found');
      return { success: true, data: { movie_id: movieId, inBookmarks } };
    });

    // UserController::toggleSubscribe — POST /api/user/toggle_subscribe/ {friendId}
    app.post('/me/subscriptions/toggle', async (request) => {
      const viewer = requireViewer(request);
      const { friendId } = parse(z.object({ friendId: id }), request.body);
      const row = await users.toggleSubscribed(db, viewer.id, friendId);
      if (!row) return { success: false, msg: 'friend not found' };
      return { success: true, friendId: row.friendId, subscribed: row.subscribed };
    });

    // UserController::subscribe — POST /api/user/subscribe/ {userId, subscribed}
    app.post('/me/subscriptions', async (request) => {
      const viewer = requireViewer(request);
      const { userId, subscribed } = parse(
        z.object({ userId: id, subscribed: flag.optional().default(false) }),
        request.body,
      );
      if (userId === viewer.id) throw new HttpError(400, 'cannot subscribe to yourself');
      if (!(await users.findPublicUser(db, userId))) throw new HttpError(404, 'user not found');
      await users.setSubscribed(db, viewer.id, userId, subscribed);
      return { success: true, userId, subscribed };
    });

    // UserController::getInviteCode — GET /api/user/invite/
    app.get('/me/invite', async (request) => {
      const viewer = requireViewer(request);
      return { success: true, code: await users.getInviteCode(db, viewer.id) };
    });

    // UserController::acceptInvite — POST /api/user/accept_invite/ {code}
    app.post('/me/invite/accept', async (request, reply) => {
      const viewer = requireViewer(request);
      const { code } = parse(
        z.object({ code: z.union([z.string(), z.number()]).transform(String).optional() }),
        request.body,
      );
      const inviter = await users.findByInviteCode(db, code ?? '');
      if (!inviter) return reply.status(404).send({ success: false, err: 'Invite not found' });
      if (inviter.id !== viewer.id) await users.makeFriends(db, viewer.id, inviter.id);
      return { success: true, inviterId: inviter.id };
    });

    // UserController::getRecommendations — GET /api/user/recommendations/
    app.get('/me/recommendations', async (request) => {
      const viewer = requireViewer(request);
      return { success: true, results: await users.getRecommendations(db, viewer.id, USERS_RECOMMENDATIONS_SIZE) };
    });

    // UserController::getAccounts — GET /api/user/accounts/
    app.get('/me/accounts', async (request) => {
      const viewer = requireViewer(request);
      return { success: true, services: await users.getLoginServices(db, viewer.id) };
    });
  };
