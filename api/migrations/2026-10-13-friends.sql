-- Finding friends without social networks: personal invite links (user.invite_code), user search
-- by name and the "followers" list (user_friends rows where user_2 = me).
-- Run on flicktips_test first; flicktips only when the feature is released.
ALTER TABLE `user`
  ADD COLUMN `invite_code` varchar(16) DEFAULT NULL,
  ADD UNIQUE KEY `invite_code_UNIQUE` (`invite_code`),
  ADD KEY `idx_username` (`username`);

ALTER TABLE `user_friends`
  ADD KEY `idx_user_2` (`user_2`);
