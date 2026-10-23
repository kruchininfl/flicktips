-- v2 migration 004: the settings' profile card. NOT applied yet; apply by hand to flicktips_test, then flicktips,
-- before deploying the API that reads it:
--   mysql flicktips_test < packages/db/migrations/004-user-profile.sql
-- New nullable columns only; the legacy PHP API never reads them.
-- Rollback: ALTER TABLE `user` DROP COLUMN `nickname`, DROP COLUMN `vkontakte_avatar`, DROP COLUMN `yandex_avatar`;

-- `nickname`: the short profile address /u/<nickname> («Ник»).
-- `<service>_avatar`: the photo of each linked sign-in account, refreshed on every sign-in, for «Сменить фото»
-- (`avatar_source` stays the photo shown).
ALTER TABLE `user`
  ADD COLUMN `nickname` varchar(32) NULL DEFAULT NULL,
  ADD COLUMN `vkontakte_avatar` varchar(255) NULL DEFAULT NULL,
  ADD COLUMN `yandex_avatar` varchar(255) NULL DEFAULT NULL,
  ADD UNIQUE KEY `nickname_UNIQUE` (`nickname`);
