-- v2 migration 004: the settings' profile card and the «Что публиковать» filter of the Telegram bot. NOT applied
-- yet; apply by hand to flicktips_test, then flicktips, before deploying the API and the bot that read it:
--   mysql flicktips_test < packages/db/migrations/004-user-profile.sql
-- New columns only (nullable or with a default); the legacy PHP API never reads them.
-- Rollback: ALTER TABLE `user` DROP COLUMN `nickname`, DROP COLUMN `vkontakte_avatar`, DROP COLUMN `yandex_avatar`,
--   DROP COLUMN `tg_publish_votes`;

-- `nickname`: the short profile address /u/<nickname> («Ник»).
-- `<service>_avatar`: the photo of each linked sign-in account, refreshed on every sign-in, for «Сменить фото»
-- (`avatar_source` stays the photo shown).
-- `tg_publish_votes`: which votes @FlickTipsBot posts, bit `1 << movie_vote.vote` (0 dislike … 3 super); 15 = all.
ALTER TABLE `user`
  ADD COLUMN `nickname` varchar(32) NULL DEFAULT NULL,
  ADD COLUMN `vkontakte_avatar` varchar(255) NULL DEFAULT NULL,
  ADD COLUMN `yandex_avatar` varchar(255) NULL DEFAULT NULL,
  ADD COLUMN `tg_publish_votes` tinyint unsigned NOT NULL DEFAULT 15,
  ADD UNIQUE KEY `nickname_UNIQUE` (`nickname`);
