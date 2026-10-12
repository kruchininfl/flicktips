-- Yandex ID sign-in: OAuthUserProvider writes `<service>_id` / `<service>_token` and relies on the
-- unique key for its INSERT ... ON DUPLICATE KEY UPDATE upsert. Run on flicktips and flicktips_test.
ALTER TABLE `user`
  ADD COLUMN `yandex_id` varchar(255) DEFAULT NULL,
  ADD COLUMN `yandex_token` varchar(255) DEFAULT NULL,
  ADD UNIQUE KEY `oauth_service_yandex_id` (`yandex_id`);
