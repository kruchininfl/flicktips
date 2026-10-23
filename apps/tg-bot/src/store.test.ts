// Integration tests against a throwaway MySQL database (TEST_DB_* env, see packages/db); skipped without it.
import { createDb } from '@flicktips/db';
import { createTestDatabase, testDbServer, type TestDatabase } from '@flicktips/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDb, exec, openDb, poolOptions, select, selectOne } from './db.js';
import * as store from './store.js';

const server = testDbServer();
const BIG_CHAT = '-1001234567890123456';

describe.skipIf(!server)('store', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    // the bot's own pool settings: bigints and dates as strings
    openDb(createDb({ ...server!, database: testDb.name, connectionLimit: 3, poolOptions }).pool);
  });

  afterAll(async () => {
    await closeDb();
    await testDb.drop();
  });

  async function addUser(username: string, tgUserId: number | null = null) {
    const result = await exec('INSERT INTO user (username, tg_user_id) VALUES (?, ?)', [username, tgUserId]);
    return result.insertId;
  }

  it('links a Telegram account to one user, the newest link wins', async () => {
    const a = await addUser('a');
    const b = await addUser('b');
    await store.linkTelegram(a, { id: 555, username: 'tgname' });
    expect((await store.findUserByTelegram(555))?.id).toBe(a);
    await store.linkTelegram(b, { id: 555 });
    expect((await store.findUserByTelegram(555))?.id).toBe(b);
    expect((await store.findUser(a))?.tg_user_id).toBeNull();
  });

  it('uses site codes once and ignores expired ones', async () => {
    const u = await addUser('coded');
    await exec(
      'INSERT INTO tg_link_code (code, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
      ['0123456789abcdef', u],
    );
    await exec(
      'INSERT INTO tg_link_code (code, user_id, expires_at) VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 5 MINUTE))',
      ['fedcba9876543210', u],
    );
    expect(store.isSiteCode('0123456789abcdef')).toBe(true);
    expect(store.isSiteCode('nope')).toBe(false);
    expect(await store.useSiteCode('fedcba9876543210', { id: 9001 })).toBeUndefined();
    expect((await store.useSiteCode('0123456789abcdef', { id: 9001 }))?.id).toBe(u);
    expect(await store.useSiteCode('0123456789abcdef', { id: 9001 })).toBeUndefined();
  });

  it('creates a code for an unlinked Telegram user', async () => {
    const code = await store.createTelegramCode({ id: 777, username: 'x' }, BIG_CHAT);
    expect(code).toMatch(/^[0-9a-f]{16}$/);
    const row = await selectOne<{ tg_user_id: string; chat_id: string }>(
      'SELECT tg_user_id, chat_id FROM tg_link_code WHERE code = ?',
      [code],
    );
    expect(row).toEqual({ tg_user_id: '777', chat_id: BIG_CHAT });
  });

  it('keeps supergroup chat ids as exact strings and tracks members and the welcome flag', async () => {
    const u = await addUser('member');
    await store.saveChat(BIG_CHAT, 'Group');
    expect((await store.getChat(BIG_CHAT))?.chat_id).toBe(BIG_CHAT);
    expect(await store.joinChat(BIG_CHAT, u)).toBe(true);
    expect(await store.joinChat(BIG_CHAT, u)).toBe(false);
    expect(await store.getMemberNames(BIG_CHAT)).toEqual(['member']);
    expect(await store.leaveChat(BIG_CHAT, u)).toBe(true);
    expect(await store.leaveChat(BIG_CHAT, u)).toBe(false);
    expect(await store.getDirtyWelcomes()).toContain(BIG_CHAT);
    await store.setWelcome(BIG_CHAT, 12);
    expect(await store.getDirtyWelcomes()).not.toContain(BIG_CHAT);
    await store.deactivateChat(BIG_CHAT);
    expect((await store.getChat(BIG_CHAT))?.active).toBe(0);
  });

  it('migrates a group to its supergroup id', async () => {
    const u = await addUser('migrant');
    await store.saveChat('-500', 'Old');
    await store.joinChat('-500', u);
    await store.migrateChat('-500', '-1000000000500');
    expect(await store.getChat('-500')).toBeUndefined();
    expect((await store.getChat('-1000000000500'))?.title).toBe('Old');
    expect(await store.getMemberNames('-1000000000500')).toEqual(['migrant']);
  });

  it('cleans up old processed events and expired codes', async () => {
    const u = await addUser('cleaner');
    await exec('INSERT INTO tg_link_code (code, user_id, expires_at) VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 1 DAY))', [
      'aaaaaaaaaaaaaaaa',
      u,
    ]);
    await store.cleanup();
    expect(await select('SELECT 1 FROM tg_link_code WHERE code = ?', ['aaaaaaaaaaaaaaaa'])).toHaveLength(0);
  });
});
