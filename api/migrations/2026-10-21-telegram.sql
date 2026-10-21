-- Telegram bot (@FlickTipsBot, service tg-bot): it posts the ratings of the FlickTips users who joined a
-- Telegram group with the «Участвовать» button. The API queues rating changes in vote_event, the bot
-- publishes them. Run on flicktips_test first; flicktips only when the feature is released.

-- the linked Telegram account
ALTER TABLE `user`
  ADD COLUMN `tg_user_id` bigint DEFAULT NULL,
  ADD COLUMN `tg_username` varchar(64) DEFAULT NULL,
  ADD UNIQUE KEY `tg_user_id_UNIQUE` (`tg_user_id`);

-- one-time codes that link a Telegram account to a FlickTips user. Made by the site (user_id set,
-- the bot fills in the Telegram side from /start <code>) or by the bot (tg_user_id set, the site
-- fills in the user on /telegram?code=...). chat_id: the group to join once linked.
CREATE TABLE `tg_link_code` (
  `code` varchar(32) NOT NULL,
  `user_id` int DEFAULT NULL,
  `tg_user_id` bigint DEFAULT NULL,
  `tg_username` varchar(64) DEFAULT NULL,
  `chat_id` bigint DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`code`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- groups the bot is in; welcome_dirty asks the bot to refresh the member list in its welcome message
CREATE TABLE `tg_chat` (
  `chat_id` bigint NOT NULL,
  `title` varchar(255) NOT NULL DEFAULT '',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `welcome_message_id` int DEFAULT NULL,
  `welcome_dirty` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`chat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FlickTips users whose ratings go to a group; checked_at: last getChatMember check
CREATE TABLE `tg_chat_member` (
  `chat_id` bigint NOT NULL,
  `user_id` int NOT NULL,
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `checked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`chat_id`, `user_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- rating changes waiting for the bot (vote NULL = removed). Processed rows are deleted after 7 days.
CREATE TABLE `vote_event` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `movie_id` int NOT NULL,
  `vote` tinyint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  `attempts` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_queue` (`processed_at`, `created_at`),
  KEY `idx_user_movie` (`user_id`, `movie_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- the post about a user's rating in a group, edited when the rating changes
CREATE TABLE `tg_post` (
  `user_id` int NOT NULL,
  `movie_id` int NOT NULL,
  `chat_id` bigint NOT NULL,
  `message_id` int NOT NULL,
  `vote` tinyint NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `movie_id`, `chat_id`),
  KEY `idx_chat_id` (`chat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Telegram file_id of a movie poster, so it is uploaded to Telegram only once
CREATE TABLE `tg_poster` (
  `movie_id` int NOT NULL,
  `file_id` varchar(255) NOT NULL,
  PRIMARY KEY (`movie_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
