// Tables added by the v2 migrations in ../../migrations (not produced by drizzle-kit pull).
import { char, datetime, index, int, mysqlTable, primaryKey, varchar } from 'drizzle-orm/mysql-core';

export const session = mysqlTable(
  'session',
  {
    // SHA-256 (hex) of the token in the cookie
    id: char({ length: 64 }).notNull(),
    userId: int('user_id').notNull(),
    createdAt: datetime('created_at', { mode: 'date' }).notNull(),
    lastSeenAt: datetime('last_seen_at', { mode: 'date' }).notNull(),
    expiresAt: datetime('expires_at', { mode: 'date' }).notNull(),
    userAgent: varchar('user_agent', { length: 255 }),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: 'session_id' }),
    index('session_user_id').on(table.userId),
    index('session_expires_at').on(table.expiresAt),
  ],
);

// Web Push subscriptions (migration 002, apps/api/docs/push.md).
export const pushSubscription = mysqlTable(
  'push_subscription',
  {
    // SHA-256 (hex) of the endpoint URL
    id: char({ length: 64 }).notNull(),
    userId: int('user_id').notNull(),
    // session.id of the sign-in that subscribed; pushes stop when that session ends
    sessionId: char('session_id', { length: 64 }).notNull(),
    endpoint: varchar({ length: 2048 }).notNull(),
    p256dh: varchar({ length: 255 }).notNull(),
    auth: varchar({ length: 255 }).notNull(),
    userAgent: varchar('user_agent', { length: 255 }),
    createdAt: datetime('created_at', { mode: 'date' }).notNull(),
    updatedAt: datetime('updated_at', { mode: 'date' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: 'push_subscription_id' }),
    index('push_subscription_user_id').on(table.userId),
    index('push_subscription_session_id').on(table.sessionId),
  ],
);
