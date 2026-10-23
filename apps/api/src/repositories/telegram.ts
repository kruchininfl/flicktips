import { randomBytes } from 'node:crypto';

import { schema, type Db } from '@flicktips/db';
import { and, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';

// Data of the Telegram bot (tg-bot service), port of api/src/Repositories/TelegramRepository.php
// (without queueVote, which moves with the vote route). Tables: api/migrations/2026-10-21-telegram.sql.

const { user, tgChat, tgChatMember, tgLinkCode } = schema;

export const LINK_CODE_TTL_SECONDS = 900;

export interface TelegramGroup {
  chat_id: string;
  title: string;
  active: boolean;
}

export interface TelegramAccount {
  tgUserId: number | null;
  tgUsername: string | null;
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// Chat ids are bigint and may not fit a JS number: they travel as strings, in SQL as string params
// (MySQL converts them exactly) and are read back through CAST ... AS CHAR.
const chatIdText = sql<string>`CAST(${tgChat.chatId} AS CHAR)`;
const chatIdParam = (chatId: string) => sql`${chatId}`;

export function telegramRepository(db: Db) {
  async function groupsOf(executor: Db | Tx, uid: number): Promise<TelegramGroup[]> {
    const rows = await executor
      .select({ chat_id: chatIdText, title: tgChat.title, active: tgChat.active })
      .from(tgChatMember)
      .innerJoin(tgChat, eq(tgChat.chatId, tgChatMember.chatId))
      .where(eq(tgChatMember.userId, uid))
      .orderBy(desc(tgChatMember.joinedAt));
    return rows.map((row) => ({ chat_id: row.chat_id, title: row.title, active: !!row.active }));
  }

  // Asks the bot to refresh the member list in the welcome message of these chats.
  async function markWelcomeDirty(executor: Db | Tx, chatIds: string[]) {
    for (const chatId of chatIds) {
      await executor
        .update(tgChat)
        .set({ welcomeDirty: 1 })
        .where(eq(tgChat.chatId, chatIdParam(chatId)));
    }
  }

  return {
    async getAccount(uid: number): Promise<TelegramAccount | null> {
      const [row] = await db
        .select({ tgUserId: user.tgUserId, tgUsername: user.tgUsername })
        .from(user)
        .where(eq(user.id, uid));
      return row ?? null;
    },

    // Groups whose posts include this user's ratings.
    getGroups: (uid: number) => groupsOf(db, uid),

    async createLinkCode(uid: number): Promise<string> {
      const code = randomBytes(8).toString('hex');
      await db.insert(tgLinkCode).values({
        code,
        userId: uid,
        expiresAt: sql`DATE_ADD(NOW(), INTERVAL ${sql.raw(String(LINK_CODE_TTL_SECONDS))} SECOND)` as unknown as string,
      });
      return code;
    },

    // A code the bot made for someone who came from a group: links their Telegram account to uid and
    // joins them to that group. Returns the group (or true without one), false for an unknown or
    // expired code.
    async confirmLinkCode(uid: number, code: string): Promise<{ chat_id: string; title: string } | boolean> {
      return db.transaction(async (tx) => {
        const [link] = await tx
          .select({
            code: tgLinkCode.code,
            tgUserId: tgLinkCode.tgUserId,
            tgUsername: tgLinkCode.tgUsername,
            chatId: sql<string | null>`CAST(${tgLinkCode.chatId} AS CHAR)`,
          })
          .from(tgLinkCode)
          .where(and(eq(tgLinkCode.code, code), isNotNull(tgLinkCode.tgUserId), sql`${tgLinkCode.expiresAt} > NOW()`));
        if (!link || link.tgUserId === null) return false;

        // a Telegram account belongs to one FlickTips user: the newest link wins
        await tx
          .update(user)
          .set({ tgUserId: null, tgUsername: null })
          .where(and(eq(user.tgUserId, link.tgUserId), ne(user.id, uid)));
        await tx.update(user).set({ tgUserId: link.tgUserId, tgUsername: link.tgUsername }).where(eq(user.id, uid));
        await tx.delete(tgLinkCode).where(eq(tgLinkCode.code, link.code));

        // PHP: `!$link['chat_id']` also treats 0 as "no group"
        if (!link.chatId || link.chatId === '0') return true;

        const [group] = await tx
          .select({ chat_id: chatIdText, title: tgChat.title })
          .from(tgChat)
          .where(and(eq(tgChat.chatId, chatIdParam(link.chatId)), eq(tgChat.active, 1)));
        if (!group) return true;

        await tx
          .insert(tgChatMember)
          .ignore()
          .values({
            chatId: sql`${group.chat_id}` as unknown as number,
            userId: uid,
            checkedAt: sql`NOW()` as unknown as string,
          });
        await markWelcomeDirty(tx, [group.chat_id]);
        return group;
      });
    },

    async leaveGroup(uid: number, chatId: string) {
      await db.transaction(async (tx) => {
        await tx
          .delete(tgChatMember)
          .where(and(eq(tgChatMember.chatId, chatIdParam(chatId)), eq(tgChatMember.userId, uid)));
        await markWelcomeDirty(tx, [chatId]);
      });
    },

    // Forgets the Telegram account and leaves every group.
    async unlink(uid: number) {
      await db.transaction(async (tx) => {
        const chatIds = (await groupsOf(tx, uid)).map((group) => group.chat_id);
        await tx.delete(tgChatMember).where(eq(tgChatMember.userId, uid));
        await tx.update(user).set({ tgUserId: null, tgUsername: null }).where(eq(user.id, uid));
        await markWelcomeDirty(tx, chatIds);
      });
    },
  };
}

export type TelegramRepository = ReturnType<typeof telegramRepository>;
