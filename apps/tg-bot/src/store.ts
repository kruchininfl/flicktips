import crypto from 'crypto';
import { exec, select, selectOne } from './db.js';
import type { User } from './texts.js';

const LINK_CODE_TTL = 15 * 60;
const USER_FIELDS = 'id, username, gender, tg_user_id, tg_publish_votes';

export interface TgUser {
  id: number;
  username?: string;
}

export function findUserByTelegram(tgUserId: number) {
  return selectOne<User>(`SELECT ${USER_FIELDS} FROM user WHERE tg_user_id = ?`, [tgUserId]);
}

export function findUser(id: number) {
  return selectOne<User>(`SELECT ${USER_FIELDS} FROM user WHERE id = ?`, [id]);
}

// a Telegram account belongs to one FlickTips user: the newest link wins
export async function linkTelegram(userId: number, from: TgUser) {
  await exec('UPDATE user SET tg_user_id = NULL, tg_username = NULL WHERE tg_user_id = ? AND id <> ?', [
    from.id,
    userId,
  ]);
  await exec('UPDATE user SET tg_user_id = ?, tg_username = ? WHERE id = ?', [from.id, from.username || null, userId]);
}

/**
 * A code made by the site (profile buttons): links its user to this Telegram account.
 * Returns the user, or undefined for an unknown or expired code.
 */
export async function useSiteCode(code: string, from: TgUser) {
  const link = await selectOne<{ user_id: number }>(
    'SELECT user_id FROM tg_link_code WHERE code = ? AND user_id IS NOT NULL AND expires_at > NOW()',
    [code],
  );

  if (!link) {
    return undefined;
  }

  await linkTelegram(link.user_id, from);
  await exec('DELETE FROM tg_link_code WHERE code = ?', [code]);

  return findUser(link.user_id);
}

export function isSiteCode(text: string) {
  return /^[0-9a-f]{16}$/.test(text);
}

/**
 * A code for someone who is not linked yet: the site finishes the link after they sign in
 * (/telegram?code=...) and joins them to chatId.
 */
export async function createTelegramCode(from: TgUser, chatId: string | null) {
  const code = crypto.randomBytes(8).toString('hex');

  await exec(
    `INSERT INTO tg_link_code (code, tg_user_id, tg_username, chat_id, expires_at)
    VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ${LINK_CODE_TTL} SECOND))`,
    [code, from.id, from.username || null, chatId],
  );

  return code;
}

export async function saveChat(chatId: string, title: string) {
  await exec(
    `INSERT INTO tg_chat (chat_id, title, active) VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE title = VALUES(title), active = 1`,
    [chatId, title],
  );
}

export function getChat(chatId: string) {
  return selectOne<{ chat_id: string; title: string; active: number; welcome_message_id: number | null }>(
    'SELECT chat_id, title, active, welcome_message_id FROM tg_chat WHERE chat_id = ?',
    [chatId],
  );
}

export async function deactivateChat(chatId: string) {
  await exec('UPDATE tg_chat SET active = 0 WHERE chat_id = ?', [chatId]);
}

export async function setWelcome(chatId: string, messageId: number | null) {
  await exec('UPDATE tg_chat SET welcome_message_id = ?, welcome_dirty = 0 WHERE chat_id = ?', [messageId, chatId]);
}

export async function getDirtyWelcomes() {
  return (await select<{ chat_id: string }>('SELECT chat_id FROM tg_chat WHERE welcome_dirty = 1 AND active = 1')).map(
    (row) => row.chat_id,
  );
}

export async function getMemberNames(chatId: string) {
  const rows = await select<{ username: string | null }>(
    `SELECT user.username FROM tg_chat_member
    INNER JOIN user ON user.id = tg_chat_member.user_id
    WHERE tg_chat_member.chat_id = ? ORDER BY tg_chat_member.joined_at`,
    [chatId],
  );

  return rows.map((row) => row.username || 'Без имени');
}

// true if the user was not a member before
export async function joinChat(chatId: string, userId: number) {
  const result = await exec('INSERT IGNORE INTO tg_chat_member (chat_id, user_id, checked_at) VALUES (?, ?, NOW())', [
    chatId,
    userId,
  ]);

  return result.affectedRows > 0;
}

// true if the user was a member
export async function leaveChat(chatId: string, userId: number) {
  const result = await exec('DELETE FROM tg_chat_member WHERE chat_id = ? AND user_id = ?', [chatId, userId]);

  if (result.affectedRows > 0) {
    await exec('UPDATE tg_chat SET welcome_dirty = 1 WHERE chat_id = ?', [chatId]);
  }

  return result.affectedRows > 0;
}

// a group became a supergroup and got a new id
export async function migrateChat(oldId: string, newId: string) {
  await exec('UPDATE IGNORE tg_chat SET chat_id = ? WHERE chat_id = ?', [newId, oldId]);
  await exec('UPDATE IGNORE tg_chat_member SET chat_id = ? WHERE chat_id = ?', [newId, oldId]);
  await exec('UPDATE IGNORE tg_post SET chat_id = ? WHERE chat_id = ?', [newId, oldId]);
  // rows left behind already existed under the new id
  await exec('DELETE FROM tg_chat WHERE chat_id = ?', [oldId]);
  await exec('DELETE FROM tg_chat_member WHERE chat_id = ?', [oldId]);
  await exec('DELETE FROM tg_post WHERE chat_id = ?', [oldId]);
}

export async function cleanup() {
  await exec('DELETE FROM vote_event WHERE processed_at < NOW() - INTERVAL 7 DAY');
  await exec('DELETE FROM tg_link_code WHERE expires_at < NOW()');
}
