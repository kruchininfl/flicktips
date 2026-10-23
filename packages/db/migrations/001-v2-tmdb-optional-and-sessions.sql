-- v2 migration 001 (approved by Artem on 2026-10-23). Apply by hand to flicktips_test, then flicktips:
--   mysql flicktips_test < packages/db/migrations/001-v2-tmdb-optional-and-sessions.sql
-- Compatible with the legacy PHP API, which keeps writing tmdb_id and never reads `session`.

-- Movies found only on Кинопоиск have no TMDB id.
ALTER TABLE `movie` MODIFY `tmdb_id` varchar(50) NULL;

-- Login sessions of the v2 API: the cookie carries a random token, the table keeps its SHA-256.
CREATE TABLE IF NOT EXISTS `session` (
  `id` char(64) NOT NULL,
  `user_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `user_agent` varchar(255) NULL,
  PRIMARY KEY (`id`),
  KEY `session_user_id` (`user_id`),
  KEY `session_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
