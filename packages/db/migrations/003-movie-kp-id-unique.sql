-- v2 migration 003: one movie per Кинопоиск film. NOT APPLIED ANYWHERE YET.
-- status: pending
--
-- Prerequisites (apps/kp-backfill/README.md, "UNIQUE key on movie.kp_id"):
--   1. `kp-backfill duplicates` reports 0 groups (dedupe-plan / dedupe-apply, plus the needs_review groups by hand);
--   2. kp-parser handles the duplicate-key error of its UPDATE (it would otherwise retry the same movie forever).
-- Check, then apply by hand to flicktips_test, then flicktips, and delete the "status: pending" line above:
--   SELECT kp_id, COUNT(*) FROM movie WHERE kp_id IS NOT NULL GROUP BY kp_id HAVING COUNT(*) > 1;  -- must be empty
--   mysql flicktips_test < packages/db/migrations/003-movie-kp-id-unique.sql
-- Rollback: ALTER TABLE `movie` DROP INDEX `kp_id`, ADD KEY `kp_id` (`kp_id`);
-- schema.ts: change index('kp_id') on movie to unique('kp_id') in the same commit as deleting the pending line.

-- The legacy movie table has '0000-00-00' date defaults, which NO_ZERO_DATE (on by default in MySQL 8) rejects
-- whenever the table is rebuilt; this session only.
SET SESSION sql_mode = REPLACE(REPLACE(@@SESSION.sql_mode, 'NO_ZERO_IN_DATE', ''), 'NO_ZERO_DATE', '');

-- Replaces the plain index of the same name. NULLs stay allowed, any number of them.
ALTER TABLE `movie` DROP INDEX `kp_id`, ADD UNIQUE KEY `kp_id` (`kp_id`);
