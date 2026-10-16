<?php

namespace Repositories;

use Silex\Application;

class UserRepository {
    protected $app;

    /**
     * @var $pdo \PDO
     */
    protected $pdo;

    protected $safety_fields = ['id', 'username', 'avatar_source AS avatar', 'gender', 'registration_date'];


    public function __construct(Application $app)
    {
        $this->app = $app;
        $this->pdo = $app['pdo'];
    }

    public function getByCredentials($uid, $token)
    {
        if (!isset($uid) || !isset($token)) {
            return null;
        }

        $safety_fields = array_map(function ($val) { return '`user`.' . $val; }, $this->safety_fields);
        $safety_fields[] = 'SUM(IF(movie_vote.timestamp > `user`.last_seen_notifications, 1, 0)) AS new_notifications';
        $sth = $this->pdo->prepare('SELECT ' . implode(', ', $safety_fields) . ', hide_viewed
        FROM user 
        LEFT JOIN `movie_vote` ON `movie_vote`.`user_id` IN (SELECT `user_friends`.`user_2` FROM `user_friends` WHERE `user_friends`.`user_1` = :uid AND `user_friends`.`subscribed` = 1)
        WHERE `user`.id = :uid AND token = :token');
        $sth->bindValue('uid', $uid);
        $sth->bindValue('token', $token);
        $sth->execute();
        $user = $sth->fetch();

        if (!$user['id']) {
            return null;
        }

        settype($user['id'], 'int');
        settype($user['hide_viewed'], 'bool');
        settype($user['new_notifications'], 'int');

        return $user;
    }

    public function findById($uid)
    {
        $sth = $this->pdo->prepare('SELECT ' . implode(', ', $this->safety_fields) . ' FROM user WHERE id = :uid');
        $sth->bindValue('uid', $uid);
        $sth->execute();
        return $sth->fetch();
    }

    public function getFriendsVotes($uid, $limit, $offset)
    {
        $sth = $this->pdo->prepare('SELECT 
        votes.vote, 
        UNIX_TIMESTAMP(votes.timestamp) as timestamp, 
        movie.id AS movie_id, 
        movie.title AS movie_title, 
        movie.original_title AS movie_original_title, 
        movie.tmdb_poster_path AS movie_tmdb_poster_path, 
        movie.release_date AS movie_release_date, 
        movie.first_air_date AS movie_first_air_date, 
        movie.tmdb_overview AS movie_tmdb_overview, 
        movie.original_language AS movie_original_language, 
        movie.tmdb_popularity AS movie_tmdb_popularity, 
        movie.super AS movie_super, 
        movie.likes AS movie_likes, 
        movie.neutral AS movie_neutral, 
        movie.dislikes AS movie_dislikes,
        IF (movie_vote.vote = \'3\', true, false) AS movie_isSuper,
        IF (movie_vote.vote = \'2\', true, false) AS movie_isLiked,
        IF (movie_vote.vote = \'1\', true, false) AS movie_isNeutral,
        IF (movie_vote.vote = \'0\', true, false) AS movie_isDisliked,
        IF (bookmark.timestamp is NULL, false, true) AS movie_inBookmarks,
        IF (u.last_seen_notifications <= votes.timestamp, true, false) AS isNew,
        genre.id AS movie_genre_id, 
        genre.name AS movie_genre_name, 
        user.id AS user_id, 
        user.username AS user_name, 
        user.avatar_source AS user_avatar, 
        user.gender AS user_gender,
        CONCAT(user.id, \'_\', movie.id) AS group_id
        FROM ( 
            SELECT *
            FROM user_friends us
            LEFT JOIN movie_vote mv ON mv.user_id = us.user_2
            WHERE user_1 = :uid AND subscribed=TRUE ORDER BY mv.timestamp DESC LIMIT :limit OFFSET :offset
        ) votes
        LEFT JOIN movie ON movie.id = votes.movie_id
        LEFT JOIN movie_genre ON movie_genre.movie_id=movie.id
        LEFT JOIN genre ON genre.id=movie_genre.genre_id
        LEFT JOIN movie_vote ON (movie_vote.user_id=:uid AND movie_vote.movie_id=movie.id)
        LEFT JOIN bookmark ON (bookmark.user_id=:uid AND bookmark.movie_id=movie.id)
        LEFT JOIN user ON user.id= votes.user_id
        LEFT JOIN user u ON u.id = :uid');
        $sth->bindValue(':uid', (int) $uid, \PDO::PARAM_INT);
        $sth->bindValue(':limit', isset($limit) ? (int) $limit : 18446744073709551615, \PDO::PARAM_INT);
        $sth->bindValue(':offset', isset($offset) ? (int) $offset : 0, \PDO::PARAM_INT);
        $sth->execute();
        $rows = $sth->fetchAll();

        $votes = $this->app['mapper']->group($rows, 'group_id', [
            'vote' => ['type' => 'int'],
            'timestamp' => ['type' => 'int'],
            'movie_id' => ['type' => 'int'],
            'movie_tmdb_popularity' => ['type' => 'float'],
            'movie_super' => ['type' => 'int'],
            'movie_likes' => ['type' => 'int'],
            'movie_neutral' => ['type' => 'int'],
            'movie_dislikes' => ['type' => 'int'],
            'movie_isSuper' => ['type' => 'bool'],
            'movie_isLiked' => ['type' => 'bool'],
            'movie_isNeutral' => ['type' => 'bool'],
            'movie_isDisliked' => ['type' => 'bool'],
            'movie_inBookmarks' => ['type' => 'bool'],
            'movie_genre_id' => ['group' => 'movie_genres', 'group_id_field' => 'movie_genre_id', 'rename' => 'id', 'type' => 'int'],
            'movie_genre_name' => ['group' => 'movie_genres', 'group_id_field' => 'movie_genre_id', 'rename' => 'name'],
            'user_id' => ['type' => 'int'],
            'isNew' => ['type' => 'bool']
        ]);

        $votes = array_map(function ($vote) {
            foreach ($vote as $key => $value) {
                if (strpos($key, 'movie') === 0) {
                    $vote['movie'][str_replace('movie_', '', $key)] = $value;
                    unset($vote[$key]);
                }

                if (strpos($key, 'user') === 0) {
                    $vote['user'][str_replace('user_', '', $key)] = $value;
                    unset($vote[$key]);
                }
            }
            return $vote;
        }, $votes);

        return $votes;
    }

    public function getBookmarks($uid, $limit, $offset)
    {
        $sth = $this->pdo->prepare('SELECT 
        movie.*,
        friend_votes.vote AS friends_votes_val, 
        friend.id AS friends_votes_user_id, 
        friend.username AS friends_votes_user_name, 
        friend.avatar AS friends_votes_user_avatar,
        UNIX_TIMESTAMP(friend_votes.timestamp) AS friends_votes_timestamp, 
        IF (friend.id IS NOT NULL, CONCAT_WS(\'_\', movie.id, friend.id), NULL) AS friends_votes_group_id,
        IF (movie_vote.vote = \'3\', true, false) AS isSuper,
        IF (movie_vote.vote = \'2\', true, false) AS isLiked,
        IF (movie_vote.vote = \'1\', true, false) AS isNeutral,
        IF (movie_vote.vote = \'0\', true, false) AS isDisliked,
        TRUE AS inBookmarks,
        genre.id AS genre_id, 
        genre.name AS genre_name
        FROM (
          SELECT movie_id FROM bookmark WHERE bookmark.user_id = :uid ORDER BY bookmark.timestamp DESC LIMIT :limit OFFSET :offset
        ) bookmarks
        LEFT JOIN movie ON movie.id = bookmarks.movie_id
        LEFT JOIN movie_genre ON movie_genre.movie_id=movie.id
        LEFT JOIN genre ON genre.id=movie_genre.genre_id
        LEFT JOIN movie_vote ON (movie_vote.user_id=:uid AND movie_vote.movie_id=movie.id)
        LEFT JOIN movie_vote AS friend_votes ON friend_votes.movie_id = movie.id AND friend_votes.user_id IN (SELECT user_friends.user_2 FROM user_friends WHERE user_friends.user_1 = :uid AND user_friends.subscribed = 1)
        LEFT JOIN `user` AS friend ON friend.id = friend_votes.user_id');
        $sth->bindValue(':uid', (int) $uid, \PDO::PARAM_INT);
        $sth->bindValue(':limit', isset($limit) ? (int) $limit : 18446744073709551615, \PDO::PARAM_INT);
        $sth->bindValue(':offset', isset($offset) ? (int) $offset : 0, \PDO::PARAM_INT);
        $sth->execute();
        $rows = $sth->fetchAll();

        $bookmarks = $this->app['mapper']->group($rows, 'id', [
            'id' => ['type' => 'int'],
            'tmdb_popularity' => ['type' => 'float'],
            'super' => ['type' => 'int'],
            'likes' => ['type' => 'int'],
            'neutral' => ['type' => 'int'],
            'dislikes' => ['type' => 'int'],
            'isSuper' => ['type' => 'bool'],
            'isLiked' => ['type' => 'bool'],
            'isNeutral' => ['type' => 'bool'],
            'isDisliked' => ['type' => 'bool'],
            'inBookmarks' => ['type' => 'bool'],
            'kp_rating_count' => ['type' => 'int'],
            'imdb_rating_count' => ['type' => 'int'],
            'kp_rating_value' => ['type' => 'float'],
            'imdb_rating_value' => ['type' => 'float'],
            'genre_id' => ['group' => 'genres', 'group_id_field' => 'genre_id', 'rename' => 'id', 'type' => 'int'],
            'genre_name' => ['group' => 'genres', 'group_id_field' => 'genre_id', 'rename' => 'name'],

            'friends_votes_user_id' => ['group' => 'friend_votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'user_id', 'type' => 'int'],
            'friends_votes_user_name' => ['group' => 'friend_votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'user_name'],
            'friends_votes_user_avatar' => ['group' => 'friend_votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'user_avatar'],
            'friends_votes_val' => ['group' => 'friend_votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'vote', 'type' => 'int'],
            'friends_votes_timestamp' => ['group' => 'friend_votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'vote_timestamp', 'type' => 'int']
        ]);

        foreach ($bookmarks as &$movie) {
            if (isset($movie['friend_votes']) && count($movie['friend_votes'])) {
                usort($movie['friend_votes'], function($a, $b) {
                    return $b['vote_timestamp'] - $a['vote_timestamp'];
                });
            }
        }

        return $bookmarks;
    }

    /**
     * People $uid follows ($type = 'following') or people following $uid ($type = 'followers').
     * `subscribed` is always "does $uid see this user's votes". Unfollowed users keep their row with
     * subscribed = 0 and drop out of both lists.
     */
    public function getFriends($uid, $limit, $offset, $type = 'following')
    {
        $safety_fields = array_map(function ($val) { return 'user.' . $val; }, $this->safety_fields);

        if ($type === 'followers') {
            $sql = 'SELECT ' . implode(', ', $safety_fields) . ', IFNULL(back.subscribed, 0) AS subscribed FROM user_friends
            INNER JOIN user ON user.id = user_friends.user_1
            LEFT JOIN user_friends back ON back.user_1 = :uid AND back.user_2 = user_friends.user_1
            WHERE user_friends.user_2 = :uid AND user_friends.subscribed = 1 ORDER BY user.id LIMIT :limit OFFSET :offset';
        } else {
            $sql = 'SELECT ' . implode(', ', $safety_fields) . ', user_friends.subscribed FROM user_friends
            INNER JOIN user ON user.id = user_friends.user_2
            WHERE user_1 = :uid AND user_friends.subscribed = 1 ORDER BY user.id LIMIT :limit OFFSET :offset';
        }

        $sth = $this->pdo->prepare($sql);
        $sth->bindValue(':uid', (int) $uid, \PDO::PARAM_INT);
        $sth->bindValue(':limit', isset($limit) ? (int) $limit : 18446744073709551615, \PDO::PARAM_INT);
        $sth->bindValue(':offset', isset($offset) ? (int) $offset : 0, \PDO::PARAM_INT);
        $sth->execute();

        return $this->castUsers($sth->fetchAll());
    }

    public function countFriends($uid, $type = 'following')
    {
        $sql = $type === 'followers'
            ? 'SELECT COUNT(*) AS num FROM user_friends INNER JOIN user ON user.id = user_friends.user_1
               WHERE user_friends.user_2 = :uid AND user_friends.subscribed = 1'
            : 'SELECT COUNT(*) AS num FROM user_friends INNER JOIN user ON user.id = user_friends.user_2
               WHERE user_friends.user_1 = :uid AND user_friends.subscribed = 1';
        $sth = $this->pdo->prepare($sql);
        $sth->execute(['uid' => (int) $uid]);

        return intval($sth->fetch()['num']);
    }

    /**
     * Users whose name contains $query, prefix matches first. $viewerId (optional) is excluded and
     * gets a `subscribed` flag per user.
     */
    public function search($query, $viewerId, $limit)
    {
        $safety_fields = array_map(function ($val) { return 'user.' . $val; }, $this->safety_fields);
        $like = addcslashes($query, '\\%_');
        $sth = $this->pdo->prepare('SELECT ' . implode(', ', $safety_fields) . ', IFNULL(uf.subscribed, 0) AS subscribed
        FROM user
        LEFT JOIN user_friends uf ON uf.user_1 = :viewer AND uf.user_2 = user.id
        WHERE user.username LIKE :contains AND user.id <> :viewer
        ORDER BY user.username LIKE :prefix DESC, user.username
        LIMIT :limit');
        $sth->bindValue(':viewer', (int) $viewerId, \PDO::PARAM_INT);
        $sth->bindValue(':contains', '%' . $like . '%');
        $sth->bindValue(':prefix', $like . '%');
        $sth->bindValue(':limit', (int) $limit, \PDO::PARAM_INT);
        $sth->execute();

        return $this->castUsers($sth->fetchAll());
    }

    /**
     * Follow state between the viewer and another user: [subscribed => viewer follows, followsMe => user follows viewer].
     */
    public function getRelation($viewerId, $userId)
    {
        $sth = $this->pdo->prepare('SELECT user_1, subscribed FROM user_friends
        WHERE (user_1 = :viewer AND user_2 = :user) OR (user_1 = :user AND user_2 = :viewer)');
        $sth->execute(['viewer' => (int) $viewerId, 'user' => (int) $userId]);

        $relation = ['subscribed' => false, 'followsMe' => false];
        foreach ($sth->fetchAll() as $row) {
            $relation[(int) $row['user_1'] === (int) $viewerId ? 'subscribed' : 'followsMe'] = (bool) $row['subscribed'];
        }

        return $relation;
    }

    public function setSubscribed($uid, $userId, $subscribed)
    {
        $sth = $this->pdo->prepare('INSERT INTO user_friends (user_1, user_2, subscribed) VALUES (:uid, :user, :subscribed)
        ON DUPLICATE KEY UPDATE subscribed = VALUES(subscribed)');
        $sth->execute(['uid' => (int) $uid, 'user' => (int) $userId, 'subscribed' => $subscribed ? 1 : 0]);
    }

    public function getInviteCode($uid)
    {
        $sth = $this->pdo->prepare('SELECT invite_code FROM user WHERE id = :uid');
        $sth->execute(['uid' => (int) $uid]);
        $code = $sth->fetchColumn();

        if ($code) {
            return $code;
        }

        // only set it if it is still empty, so two parallel requests end up with the same code
        $sth = $this->pdo->prepare('UPDATE user SET invite_code = :code WHERE id = :uid AND invite_code IS NULL');
        $sth->execute(['uid' => (int) $uid, 'code' => bin2hex(random_bytes(6))]);

        return $this->getInviteCode($uid);
    }

    public function findByInviteCode($code)
    {
        $sth = $this->pdo->prepare('SELECT ' . implode(', ', $this->safety_fields) . ' FROM user WHERE invite_code = :code');
        $sth->execute(['code' => (string) $code]);
        $user = $sth->fetch();

        if ($user) {
            settype($user['id'], 'int');
        }

        return $user;
    }

    /**
     * An accepted invite makes both users follow each other.
     */
    public function makeFriends($uid, $friendId)
    {
        $sth = $this->pdo->prepare('INSERT INTO user_friends (user_1, user_2, subscribed) VALUES (:user1, :user2, 1), (:user2, :user1, 1)
        ON DUPLICATE KEY UPDATE subscribed = 1');
        $sth->execute(['user1' => (int) $uid, 'user2' => (int) $friendId]);
    }

    /**
     * Up to $limit people for $uid to follow: friends of friends first (most mutual follows), then
     * people who voted the same way on the same movies, then random users (those with votes first).
     * Each gets `reason` (friends | votes | random) and `reason_count` (mutual follows / matching votes).
     */
    public function getRecommendations($uid, $limit)
    {
        $uid = (int) $uid;
        $fields = implode(', ', array_map(function ($val) { return 'user.' . $val; }, $this->safety_fields));

        $sth = $this->pdo->prepare('SELECT user_2 FROM user_friends WHERE user_1 = :uid AND subscribed = 1');
        $sth->execute(['uid' => $uid]);
        $exclude = array_map('intval', $sth->fetchAll(\PDO::FETCH_COLUMN));
        $exclude[] = $uid;

        $result = [];
        $add = function ($rows, $reason) use (&$result, &$exclude, $limit) {
            foreach ($rows as $row) {
                if (count($result) >= $limit || in_array((int) $row['id'], $exclude, true)) {
                    continue;
                }
                $exclude[] = (int) $row['id'];
                $row['reason'] = $reason;
                $row['reason_count'] = isset($row['reason_count']) ? (int) $row['reason_count'] : 0;
                $row['subscribed'] = false;
                $result[] = $row;
            }
        };
        // ids are ints from the DB, safe to inline
        $notIn = function () use (&$exclude) {
            return implode(',', $exclude);
        };

        // people followed by the people I follow
        $sth = $this->pdo->prepare('SELECT ' . $fields . ', COUNT(DISTINCT mine.user_2) AS reason_count
        FROM user_friends mine
        INNER JOIN user_friends theirs ON theirs.user_1 = mine.user_2 AND theirs.subscribed = 1
        INNER JOIN user ON user.id = theirs.user_2
        WHERE mine.user_1 = :uid AND mine.subscribed = 1 AND user.id NOT IN (' . $notIn() . ')
        GROUP BY user.id ORDER BY reason_count DESC, user.id DESC LIMIT :limit');
        $sth->bindValue(':uid', $uid, \PDO::PARAM_INT);
        $sth->bindValue(':limit', (int) $limit, \PDO::PARAM_INT);
        $sth->execute();
        $add($sth->fetchAll(), 'friends');

        // same vote on the same movie, at least 2 such movies
        if (count($result) < $limit) {
            $sth = $this->pdo->prepare('SELECT ' . $fields . ', COUNT(*) AS reason_count
            FROM movie_vote mine
            INNER JOIN movie_vote theirs ON theirs.movie_id = mine.movie_id AND theirs.vote = mine.vote
            INNER JOIN user ON user.id = theirs.user_id
            WHERE mine.user_id = :uid AND user.id NOT IN (' . $notIn() . ')
            GROUP BY user.id HAVING reason_count >= 2 ORDER BY reason_count DESC LIMIT :limit');
            $sth->bindValue(':uid', $uid, \PDO::PARAM_INT);
            $sth->bindValue(':limit', (int) ($limit - count($result)), \PDO::PARAM_INT);
            $sth->execute();
            $add($sth->fetchAll(), 'votes');
        }

        if (count($result) < $limit) {
            $sth = $this->pdo->prepare('SELECT ' . $fields . ' FROM user
            WHERE user.id NOT IN (' . $notIn() . ')
            ORDER BY EXISTS (SELECT 1 FROM movie_vote WHERE movie_vote.user_id = user.id) DESC, RAND() LIMIT :limit');
            $sth->bindValue(':limit', (int) ($limit - count($result)), \PDO::PARAM_INT);
            $sth->execute();
            $add($sth->fetchAll(), 'random');
        }

        foreach ($result as &$row) {
            settype($row['id'], 'int');
        }

        return $result;
    }

    private function castUsers($rows)
    {
        foreach ($rows as &$row) {
            settype($row['id'], 'int');
            $row['subscribed'] = (bool) $row['subscribed'];
        }

        return $rows;
    }
}