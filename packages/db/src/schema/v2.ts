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
