import { schema } from '@flicktips/db';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { hasTestDb, signIn, useTestApp } from '../../test/helpers.js';

const { user, tgChat, tgChatMember, tgLinkCode } = schema;

// Above 2^31: chat ids of supergroups look like this.
const GROUP = -1001234567890;
const OTHER_GROUP = -1009876543210;

describe.skipIf(!hasTestDb)('telegram routes', () => {
  const ctx = useTestApp();
  const db = () => ctx.t.db;
  const inject = (method: 'GET' | 'POST' | 'DELETE', url: string, headers?: Record<string, string>, payload?: object) =>
    ctx.app.inject({ method, url, headers, payload });

  const unauthorized = { success: false, msg: 'authorization required' };

  it('answers 401 without credentials', async () => {
    for (const [method, url] of [
      ['GET', '/api/me/telegram'],
      ['POST', '/api/me/telegram/link'],
      ['POST', '/api/me/telegram/confirm'],
      ['DELETE', `/api/me/telegram/groups/${GROUP}`],
      ['DELETE', '/api/me/telegram'],
    ] as const) {
      const res = await inject(method, url);
      expect(res.statusCode, `${method} ${url}`).toBe(401);
      expect(res.json()).toEqual(unauthorized);
    }
  });

  it('reports an unlinked account', async () => {
    const { headers } = await signIn(ctx);
    const res = await inject('GET', '/api/me/telegram', headers);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      success: true,
      linked: false,
      username: null,
      botUsername: 'FlickTipsBot',
      groups: [],
    });
  });

  it('reports a linked account with its groups, newest first', async () => {
    const { id, headers } = await signIn(ctx, { tgUserId: 777000111, tgUsername: 'tester' });
    await db()
      .insert(tgChat)
      .values([
        { chatId: GROUP, title: 'Кино по пятницам', active: 1 },
        { chatId: OTHER_GROUP, title: 'Old group', active: 0 },
      ]);
    await db()
      .insert(tgChatMember)
      .values([
        { chatId: GROUP, userId: id, joinedAt: '2026-01-02 10:00:00' },
        { chatId: OTHER_GROUP, userId: id, joinedAt: '2026-03-04 10:00:00' },
      ]);
    const res = await inject('GET', '/api/me/telegram', headers);
    expect(res.json()).toEqual({
      success: true,
      linked: true,
      username: 'tester',
      botUsername: 'FlickTipsBot',
      groups: [
        { chat_id: String(OTHER_GROUP), title: 'Old group', active: false },
        { chat_id: String(GROUP), title: 'Кино по пятницам', active: true },
      ],
    });
    await db().delete(tgChatMember).where(eq(tgChatMember.userId, id));
    await db().delete(tgChat);
  });

  it('creates a link code valid for 15 minutes', async () => {
    const { id, headers } = await signIn(ctx);
    const res = await inject('POST', '/api/me/telegram/link', headers);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toMatch(/^[0-9a-f]{16}$/);
    expect(body).toEqual({
      success: true,
      code: body.code,
      startUrl: `https://t.me/FlickTipsBot?start=${body.code}`,
      groupUrl: `https://t.me/FlickTipsBot?startgroup=${body.code}`,
    });
    const [row] = await db()
      .select({
        userId: tgLinkCode.userId,
        tgUserId: tgLinkCode.tgUserId,
        chatId: tgLinkCode.chatId,
        ttl: sql<number>`TIMESTAMPDIFF(SECOND, NOW(), ${tgLinkCode.expiresAt})`,
      })
      .from(tgLinkCode)
      .where(eq(tgLinkCode.code, body.code));
    expect(row).toMatchObject({ userId: id, tgUserId: null, chatId: null });
    expect(Number(row?.ttl)).toBeGreaterThan(880);
    expect(Number(row?.ttl)).toBeLessThanOrEqual(900);
  });

  describe('confirm', () => {
    it('links the account and joins the group of a bot-made code', async () => {
      const { id, headers } = await signIn(ctx);
      const previous = await signIn(ctx, { tgUserId: 555001, tgUsername: 'old_owner' });
      await db().insert(tgChat).values({ chatId: GROUP, title: 'Кино по пятницам', active: 1 });
      await db()
        .insert(tgLinkCode)
        .values({
          code: 'botcode1',
          tgUserId: 555001,
          tgUsername: 'newcomer',
          chatId: GROUP,
          expiresAt: sql`DATE_ADD(NOW(), INTERVAL 10 MINUTE)` as unknown as string,
        });

      const res = await inject('POST', '/api/me/telegram/confirm', headers, { code: 'botcode1' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true, group: { chat_id: String(GROUP), title: 'Кино по пятницам' } });

      const [linked] = await db().select().from(user).where(eq(user.id, id));
      expect(linked).toMatchObject({ tgUserId: 555001, tgUsername: 'newcomer' });
      const [old] = await db().select().from(user).where(eq(user.id, previous.id));
      expect(old).toMatchObject({ tgUserId: null, tgUsername: null });
      const members = await db().select().from(tgChatMember).where(eq(tgChatMember.userId, id));
      expect(members).toHaveLength(1);
      expect(members[0]?.chatId).toBe(GROUP);
      expect(members[0]?.checkedAt).not.toBeNull();
      const [chat] = await db().select().from(tgChat).where(eq(tgChat.chatId, GROUP));
      expect(chat?.welcomeDirty).toBe(1);
      expect(await db().select().from(tgLinkCode).where(eq(tgLinkCode.code, 'botcode1'))).toHaveLength(0);

      // the code is single-use
      const again = await inject('POST', '/api/me/telegram/confirm', headers, { code: 'botcode1' });
      expect(again.statusCode).toBe(404);
      await db().delete(tgChatMember);
      await db().delete(tgChat);
    });

    it('answers group null for a code without a group, taking the code from the query too', async () => {
      const { id, headers } = await signIn(ctx);
      await db()
        .insert(tgLinkCode)
        .values({
          code: 'botcode2',
          tgUserId: 555002,
          tgUsername: null,
          expiresAt: sql`DATE_ADD(NOW(), INTERVAL 10 MINUTE)` as unknown as string,
        });
      const res = await inject('POST', '/api/me/telegram/confirm?code=botcode2', headers);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true, group: null });
      const [linked] = await db().select().from(user).where(eq(user.id, id));
      expect(linked).toMatchObject({ tgUserId: 555002, tgUsername: null });
    });

    it('answers group null when the group is inactive', async () => {
      const { id, headers } = await signIn(ctx);
      await db().insert(tgChat).values({ chatId: OTHER_GROUP, title: 'Old group', active: 0 });
      await db()
        .insert(tgLinkCode)
        .values({
          code: 'botcode3',
          tgUserId: 555003,
          chatId: OTHER_GROUP,
          expiresAt: sql`DATE_ADD(NOW(), INTERVAL 10 MINUTE)` as unknown as string,
        });
      const res = await inject('POST', '/api/me/telegram/confirm', headers, { code: 'botcode3' });
      expect(res.json()).toEqual({ success: true, group: null });
      expect(await db().select().from(tgChatMember).where(eq(tgChatMember.userId, id))).toHaveLength(0);
      await db().delete(tgChat);
    });

    it('answers 404 for unknown, expired and site-made codes', async () => {
      const { id, headers } = await signIn(ctx);
      await db()
        .insert(tgLinkCode)
        .values([
          {
            code: 'expired1',
            tgUserId: 555004,
            expiresAt: sql`DATE_SUB(NOW(), INTERVAL 1 MINUTE)` as unknown as string,
          },
          {
            code: 'sitecode',
            userId: id,
            expiresAt: sql`DATE_ADD(NOW(), INTERVAL 10 MINUTE)` as unknown as string,
          },
        ]);
      for (const payload of [{ code: 'nope' }, { code: 'expired1' }, { code: 'sitecode' }, {}]) {
        const res = await inject('POST', '/api/me/telegram/confirm', headers, payload);
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ success: false, err: 'Code not found or expired' });
      }
    });
  });

  it('leaves a group and marks its welcome message dirty', async () => {
    const { id, headers } = await signIn(ctx, { tgUserId: 777000222, tgUsername: 'leaver' });
    const mate = await signIn(ctx);
    await db()
      .insert(tgChat)
      .values([
        { chatId: GROUP, title: 'One', active: 1 },
        { chatId: OTHER_GROUP, title: 'Two', active: 1 },
      ]);
    await db()
      .insert(tgChatMember)
      .values([
        { chatId: GROUP, userId: id },
        { chatId: GROUP, userId: mate.id },
        { chatId: OTHER_GROUP, userId: id },
      ]);
    const res = await inject('DELETE', `/api/me/telegram/groups/${GROUP}`, headers);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });

    const left = await db().select().from(tgChatMember).where(eq(tgChatMember.chatId, GROUP));
    expect(left.map((m) => m.userId)).toEqual([mate.id]);
    const [stay] = await db().select().from(tgChatMember).where(eq(tgChatMember.userId, id));
    expect(stay?.chatId).toBe(OTHER_GROUP);
    const [one] = await db().select().from(tgChat).where(eq(tgChat.chatId, GROUP));
    const [two] = await db().select().from(tgChat).where(eq(tgChat.chatId, OTHER_GROUP));
    expect([one?.welcomeDirty, two?.welcomeDirty]).toEqual([1, 0]);

    // leaving a group you are not in is still a success, as in PHP
    const again = await inject('DELETE', `/api/me/telegram/groups/${GROUP}`, headers);
    expect(again.json()).toEqual({ success: true });
    await db().delete(tgChatMember);
    await db().delete(tgChat);
  });

  it('answers 404 for a chat id that is not an integer', async () => {
    const { headers } = await signIn(ctx);
    for (const chatId of ['abc', '12x', '--5']) {
      const res = await inject('DELETE', `/api/me/telegram/groups/${chatId}`, headers);
      expect(res.statusCode, chatId).toBe(404);
      expect(res.json()).toEqual({ success: false, err: 'Not found' });
    }
  });

  it('unlinks the account and leaves every group', async () => {
    const { id, headers } = await signIn(ctx, { tgUserId: 777000333, tgUsername: 'goner' });
    await db()
      .insert(tgChat)
      .values([
        { chatId: GROUP, title: 'One', active: 1 },
        { chatId: OTHER_GROUP, title: 'Two', active: 1 },
      ]);
    await db()
      .insert(tgChatMember)
      .values([
        { chatId: GROUP, userId: id },
        { chatId: OTHER_GROUP, userId: id },
      ]);
    const res = await inject('DELETE', '/api/me/telegram', headers);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });

    const [row] = await db().select().from(user).where(eq(user.id, id));
    expect(row).toMatchObject({ tgUserId: null, tgUsername: null });
    expect(await db().select().from(tgChatMember).where(eq(tgChatMember.userId, id))).toHaveLength(0);
    const chats = await db().select().from(tgChat);
    expect(chats.map((c) => c.welcomeDirty)).toEqual([1, 1]);

    const status = await inject('GET', '/api/me/telegram', headers);
    expect(status.json()).toEqual({
      success: true,
      linked: false,
      username: null,
      botUsername: 'FlickTipsBot',
      groups: [],
    });
    await db().delete(tgChat);
  });
});
