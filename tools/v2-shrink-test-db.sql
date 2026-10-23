-- Shrinks the test database for the v2 test target (tools/v2-test-setup.sh shrink): keeps the 10 oldest users and
-- the movies they voted for, removes everything that pointed at the rest, then recounts the movies' vote counters.
-- Only for flicktips_test: the first statement fails (and the mysql client stops) on any other database.
SELECT IF(DATABASE() = 'flicktips_test', 1, (SELECT 1 UNION SELECT 2)) AS `only_flicktips_test`;

SET SESSION sql_mode = '';
-- millions of deleted rows must not land in the binary log on the nearly full disk (the test DB is not replicated)
SET SESSION sql_log_bin = 0;

DROP TABLE IF EXISTS _shrink_keep_user, _shrink_keep_movie;
CREATE TABLE _shrink_keep_user (id int PRIMARY KEY)
SELECT id FROM `user` ORDER BY registration_date IS NULL, registration_date, id LIMIT 10;

DELETE FROM bookmark WHERE user_id NOT IN (SELECT id FROM _shrink_keep_user);
DELETE FROM movie_vote WHERE user_id NOT IN (SELECT id FROM _shrink_keep_user);
DELETE FROM vote_event WHERE user_id NOT IN (SELECT id FROM _shrink_keep_user);
DELETE FROM tg_post WHERE user_id NOT IN (SELECT id FROM _shrink_keep_user);
DELETE FROM tg_chat_member WHERE user_id NOT IN (SELECT id FROM _shrink_keep_user);
DELETE FROM tg_link_code WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM _shrink_keep_user);
DELETE FROM user_friends WHERE user_1 NOT IN (SELECT id FROM _shrink_keep_user) OR user_2 NOT IN (SELECT id FROM _shrink_keep_user);
DELETE FROM `user` WHERE id NOT IN (SELECT id FROM _shrink_keep_user);

-- movies without a vote (of the users left)
CREATE TABLE _shrink_keep_movie (id int PRIMARY KEY) SELECT DISTINCT movie_id AS id FROM movie_vote;

DELETE FROM bookmark WHERE movie_id NOT IN (SELECT id FROM _shrink_keep_movie);
DELETE FROM vote_event WHERE movie_id NOT IN (SELECT id FROM _shrink_keep_movie);
DELETE FROM tg_post WHERE movie_id NOT IN (SELECT id FROM _shrink_keep_movie);
DELETE FROM tg_poster WHERE movie_id NOT IN (SELECT id FROM _shrink_keep_movie);
DELETE FROM movie_country WHERE movie_id NOT IN (SELECT id FROM _shrink_keep_movie);
DELETE FROM movie_genre WHERE movie_id NOT IN (SELECT id FROM _shrink_keep_movie);
DELETE FROM `movie_kp-genre` WHERE movie_id NOT IN (SELECT id FROM _shrink_keep_movie);
DELETE FROM movie_people WHERE movie_id NOT IN (SELECT id FROM _shrink_keep_movie);
DELETE FROM movie WHERE id NOT IN (SELECT id FROM _shrink_keep_movie);

-- people left without a movie
DELETE p FROM people p LEFT JOIN movie_people mp ON mp.people_id = p.id WHERE mp.people_id IS NULL;

-- vote counters of the movies left: 3 super, 2 like, 1 neutral, 0 dislike
UPDATE movie m
LEFT JOIN (
  SELECT movie_id, SUM(vote = 3) AS s, SUM(vote = 2) AS l, SUM(vote = 1) AS n, SUM(vote = 0) AS d
  FROM movie_vote GROUP BY movie_id
) v ON v.movie_id = m.id
SET m.super = COALESCE(v.s, 0), m.likes = COALESCE(v.l, 0), m.neutral = COALESCE(v.n, 0), m.dislikes = COALESCE(v.d, 0);

SELECT (SELECT COUNT(*) FROM `user`) AS users, (SELECT COUNT(*) FROM movie) AS movies,
  (SELECT COUNT(*) FROM movie_vote) AS votes, (SELECT COUNT(*) FROM bookmark) AS bookmarks,
  (SELECT COUNT(*) FROM people) AS people;

DROP TABLE _shrink_keep_user, _shrink_keep_movie;
