import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { requireViewer } from '../auth/viewer.js';
import type { AppDeps } from '../deps.js';
import { badRequest, HttpError, notFound } from '../lib/errors.js';
import { publishedVotes, telegramRepository, VOTE_NAMES } from '../repositories/telegram.js';

const publishBody = z.object({ publish: z.array(z.enum(VOTE_NAMES)).max(VOTE_NAMES.length) });

// The «Telegram» block of the profile: linking a Telegram account and the groups where @FlickTipsBot
// posts the user's ratings. Port of api/src/Controllers/TelegramController.php.
export const telegramRoutes =
  (deps: AppDeps): FastifyPluginAsync =>
  async (app) => {
    const repo = telegramRepository(deps.db);
    const botUrl = `https://t.me/${deps.config.telegramBotUsername}`;

    // The legacy client sends Content-Type: application/json on every request, bodiless ones included
    // (PHP ignored an empty body); Fastify would answer those with 400.
    app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
      const text = String(body).trim();
      if (!text) return done(null, undefined);
      try {
        done(null, JSON.parse(text));
      } catch {
        done(new HttpError(400, 'Invalid JSON body'));
      }
    });

    app.get('/me/telegram', async (request) => {
      const viewer = requireViewer(request);
      const account = await repo.getAccount(viewer.id);
      return {
        success: true,
        linked: !!account?.tgUserId,
        username: account?.tgUsername ?? null,
        botUsername: deps.config.telegramBotUsername,
        groups: await repo.getGroups(viewer.id),
        // v2: «Что публиковать», the votes the bot posts
        publish: publishedVotes(account?.tgPublishVotes ?? 15),
      };
    });

    // «Что публиковать»: the votes the bot posts to the groups; the others are not posted (their old posts stay)
    app.patch('/me/telegram', async (request) => {
      const viewer = requireViewer(request);
      const body = publishBody.safeParse(request.body ?? {});
      if (!body.success) throw badRequest('publish: a list of dislike, neutral, like, super');
      await repo.setPublishedVotes(viewer.id, body.data.publish);
      return { success: true, publish: publishedVotes((await repo.getAccount(viewer.id))?.tgPublishVotes ?? 15) };
    });

    // A fresh one-time code and the t.me links that pass it to the bot: one opens a chat with it (links
    // the account), the other adds it to a group (links the account and joins that group).
    app.post('/me/telegram/link', async (request) => {
      const viewer = requireViewer(request);
      const code = await repo.createLinkCode(viewer.id);
      return {
        success: true,
        code,
        startUrl: `${botUrl}?start=${code}`,
        groupUrl: `${botUrl}?startgroup=${code}`,
      };
    });

    // /telegram?code=... page: someone pressed «Участвовать» in a group before linking, the bot sent them here.
    app.post('/me/telegram/confirm', async (request) => {
      const viewer = requireViewer(request);
      const body = request.body as Record<string, unknown> | null | undefined;
      const query = request.query as Record<string, unknown>;
      const raw = body && typeof body === 'object' ? (body['code'] ?? query['code']) : query['code'];
      const code = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';

      const result = await repo.confirmLinkCode(viewer.id, code);
      if (!result) throw notFound('Code not found or expired');
      return { success: true, group: result === true ? null : result };
    });

    app.delete<{ Params: { chatId: string } }>('/me/telegram/groups/:chatId', async (request) => {
      const viewer = requireViewer(request);
      const { chatId } = request.params;
      // same constraint as PHP's ->assert('chatId', '-?\d+'): anything else is an unknown route
      if (!/^-?\d+$/.test(chatId)) throw new HttpError(404, 'Not found', { success: false, err: 'Not found' });
      await repo.leaveGroup(viewer.id, chatId);
      return { success: true };
    });

    app.delete('/me/telegram', async (request) => {
      const viewer = requireViewer(request);
      await repo.unlink(viewer.id);
      return { success: true };
    });
  };
