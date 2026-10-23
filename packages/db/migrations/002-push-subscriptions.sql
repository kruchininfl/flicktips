-- v2 migration 002: Web Push subscriptions (apps/api/docs/push.md). NOT applied yet; apply by hand to
-- flicktips_test, then flicktips:
--   mysql flicktips_test < packages/db/migrations/002-push-subscriptions.sql
-- New table only; the legacy PHP API never reads it.

-- One row per browser push subscription. `id` is the SHA-256 (hex) of the endpoint URL, so a browser that
-- subscribes again (or signs in as someone else) updates its row instead of adding one. The row belongs to the
-- session that created it: pushes go only to rows whose session still exists, so signing out stops them.
CREATE TABLE IF NOT EXISTS `push_subscription` (
  `id` char(64) NOT NULL,
  `user_id` int NOT NULL,
  `session_id` char(64) NOT NULL,
  `endpoint` varchar(2048) NOT NULL,
  `p256dh` varchar(255) NOT NULL,
  `auth` varchar(255) NOT NULL,
  `user_agent` varchar(255) NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `push_subscription_user_id` (`user_id`),
  KEY `push_subscription_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
