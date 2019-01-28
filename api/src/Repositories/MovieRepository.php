<?php

namespace Repositories;

use Silex\Application;

class MovieRepository {
    protected $app;

    /**
     * @var $pdo \PDO
     */
    protected $pdo;

    public function __construct(Application $app)
    {
        $this->app = $app;
        $this->pdo = $app['pdo'];
    }

    public function getFilm($id, $userId = null) {
        $query = 'SELECT 
            movie.*, genre.id AS genre_id, genre.name AS genre_name, false as isLiked, false as isNeutral, false as isDisliked,
            country.name AS country_name, country.id AS country_id,
            CONCAT_WS(\'_\', people.id, `group`.id) AS people_field_group, people.id AS people_id, people.name AS people_name, people.original_name AS people_original_name, people.kp_photo AS people_photo, movie_people.order AS people_order, movie_people.description AS people_description, `group`.type AS people_group_type, `group`.title AS people_group_title,
            UNIX_TIMESTAMP(votes.timestamp) as vote_timestamp,
            votes.vote as vote_val,
            `user`.id as vote_user_id,
            `user`.username as vote_user_username,
            `user`.avatar as vote_user_avatar,
            CONCAT_WS(\'_\', `user`.id, movie.id) AS votes_field_group';
        if ($userId) {
            $query .= ', IF (movie_vote.vote = \'2\', true, false) AS isLiked,
            IF (movie_vote.vote = \'1\', true, false) AS isNeutral,
            IF (movie_vote.vote = \'0\', true, false) AS isDisliked,
            IF (bookmark.timestamp is NULL, false, true) AS inBookmarks';
        }

        $query .= ' FROM movie
            LEFT JOIN movie_genre ON movie_genre.movie_id=movie.id 
            LEFT JOIN genre ON genre.id=movie_genre.genre_id
            
            LEFT JOIN movie_country ON movie_country.movie_id=movie.id 
            LEFT JOIN country ON country.id=movie_country.country_id
            
            LEFT JOIN movie_people ON movie_people.movie_id=movie.id 
            LEFT JOIN people ON people.id=movie_people.people_id  AND people.suspend = "0"
            LEFT JOIN `group` ON `group`.id=movie_people.group_id
            
            LEFT JOIN movie_vote AS votes ON votes.movie_id = movie.id
            LEFT JOIN `user` ON `user`.id = votes.user_id';
        if ($userId) {
            $query .= ' 
            LEFT JOIN movie_vote ON movie_vote.movie_id=movie.id AND movie_vote.user_id=' . $userId . '
            LEFT JOIN bookmark ON (bookmark.user_id=' . $userId . ' AND bookmark.movie_id=movie.id)';
        }
        $query .= ' WHERE movie.id = ' . $id;

        $sth = $this->pdo->prepare($query);
        $sth->execute();
        $rows = $sth->fetchAll();

        if (!count($rows)) {
            return null;
        }

        $movie = $this->app['mapper']->group($rows, 'id', [
            'id' => ['type' => 'int'],
            'likes' => ['type' => 'int'],
            'neutral' => ['type' => 'int'],
            'dislikes' => ['type' => 'int'],
            'isLiked' => ['type' => 'bool'],
            'isNeutral' => ['type' => 'bool'],
            'isDisliked' => ['type' => 'bool'],
            'inBookmarks' => ['type' => 'bool'],
            'tmdb_popularity' => ['type' => 'float'],
            'kp_rating_value' => ['type' => 'float'],
            'kp_rating_count' => ['type' => 'int'],
            'imdb_rating_value' => ['type' => 'float'],
            'imdb_rating_count' => ['type' => 'int'],

            'genre_id' => ['group' => 'genres', 'group_id_field' => 'genre_id', 'rename' => 'id', 'type' => 'int'],
            'genre_name' => ['group' => 'genres', 'group_id_field' => 'genre_id', 'rename' => 'name'],

            'country_id' => ['group' => 'countries', 'group_id_field' => 'country_id', 'rename' => 'id', 'type' => 'int'],
            'country_name' => ['group' => 'countries', 'group_id_field' => 'country_id', 'rename' => 'name'],

            'people_id' => ['group' => 'staff', 'group_id_field' => 'people_field_group', 'rename' => 'id', 'type' => 'int'],
            'people_field_group' => ['group' => 'staff', 'group_id_field' => 'people_field_group', 'rename' => 'id_group'],
            'people_name' => ['group' => 'staff', 'group_id_field' => 'people_field_group', 'rename' => 'name'],
            'people_original_name' => ['group' => 'staff', 'group_id_field' => 'people_field_group', 'rename' => 'original_name'],
            'people_photo' => ['group' => 'staff', 'group_id_field' => 'people_field_group', 'rename' => 'photo'],
            'people_order' => ['group' => 'staff', 'group_id_field' => 'people_field_group', 'rename' => 'order', 'type' => 'int'],
            'people_description' => ['group' => 'staff', 'group_id_field' => 'people_field_group', 'rename' => 'description'],
            'people_group_type' => ['group' => 'staff', 'group_id_field' => 'people_field_group', 'rename' => 'group_type'],
            'people_group_title' => ['group' => 'staff', 'group_id_field' => 'people_field_group', 'rename' => 'group_title'],

            'vote_timestamp' => ['group' => 'votes', 'group_id_field' => 'votes_field_group', 'rename' => 'timestamp', 'type' => 'int'],
            'vote_val' => ['group' => 'votes', 'group_id_field' => 'votes_field_group', 'rename' => 'value', 'type' => 'int'],
            'vote_user_id' => ['group' => 'votes', 'group_id_field' => 'votes_field_group', 'rename' => 'user_id', 'type' => 'int'],
            'vote_user_username' => ['group' => 'votes', 'group_id_field' => 'votes_field_group', 'rename' => 'user_name'],
            'vote_user_avatar' => ['group' => 'votes', 'group_id_field' => 'votes_field_group', 'rename' => 'user_avatar']
        ])[0];

        unset($movie['kp_check_date']);
        unset($movie['kp_error']);

        // group staff
        if (isset($movie['staff']) && count($movie['staff'])) {
            usort($movie['staff'], function($a, $b) {
                return $a['order'] - $b['order'];
            });
            $staff = [];
            foreach($movie['staff'] as $key => $item)
            {
                $gtype = $item['group_type'];
                $gtitle = $item['group_title'];

                unset($item['group_type']);
                unset($item['id_group']);
                unset($item['group_title']);
                unset($item['order']);

                $staff[$gtype]['type'] = $gtype;
                $staff[$gtype]['title'] = $gtitle;
                $staff[$gtype]['people'][] = $item;
            }
            $movie['staff'] = array_values($staff);
        }

        if ($userId && isset($movie['friend_votes']) && count($movie['friend_votes'])) {
            usort($movie['friend_votes'], function($a, $b) {
                return $b['vote_timestamp'] - $a['vote_timestamp'];
            });
        }

        if (isset($movie['votes']) && count($movie['votes'])) {
            usort($movie['votes'], function($a, $b) {
                return $b['timestamp'] - $a['timestamp'];
            });
        }

        return $movie;
    }

    public function getFilmVotes($id, $userId = null) {
        $query = 'SELECT 
            mv.id, mv.vote, mv.timestamp, mv.user_id, 
            u.avatar AS user_avatar, u.gender AS user_gender, u.username AS user_username,';
        if ($userId) {
            $query .= 'IF (uf.user_1 is NULL, false, true) AS user_isFriend';
        } else {
            $query .= '0 AS user_isFriend';
        }

        $query .= ' FROM movie_vote AS mv
            LEFT JOIN user u ON u.id=mv.user_id';

        if ($userId) {
            $query .= ' LEFT JOIN user_friends uf ON uf.user_1=' . $userId . ' AND uf.user_2=u.id';
        }

        $query .= ' WHERE mv.movie_id = ' . $id;
        $query .= ' ORDER BY mv.timestamp DESC';

        $sth = $this->pdo->prepare($query);
        $sth->execute();
        $rows = $sth->fetchAll();

        if (!count($rows)) {
            return [];
        }

        $votes = $this->app['mapper']->group($rows, 'id', [
            'id' => ['type' => 'int'],
            'vote' => ['type' => 'int'],
            'user_id' => ['group' => 'user', 'group_id_field' => 'user_id', 'rename' => 'id', 'type' => 'int'],
            'user_avatar' => ['group' => 'user', 'group_id_field' => 'user_id', 'rename' => 'avatar', 'type' => 'string'],
            'user_gender' => ['group' => 'user', 'group_id_field' => 'user_id', 'rename' => 'gender', 'type' => 'string'],
            'user_username' => ['group' => 'user', 'group_id_field' => 'user_id', 'rename' => 'username', 'type' => 'string'],
            'user_isFriend' => ['group' => 'user', 'group_id_field' => 'user_id', 'rename' => 'isFriend', 'type' => 'bool']
        ]);

        return array_map(function($vote) {
            $vote['user'] = $vote['user'][0];
            return $vote;
        }, $votes);
    }

    public function findByUserId($requesterUid, $uid, $limit, $offset)
    {
        $query = 'SELECT id FROM movie_vote WHERE user_id = :uid ORDER BY movie_vote.timestamp DESC LIMIT :limit OFFSET :offset';
        $sth = $this->pdo->prepare($query);
        $sth->bindValue(':uid', (int) $uid, \PDO::PARAM_INT);
        $sth->bindValue(':limit', isset($limit) ? (int) $limit : 18446744073709551615, \PDO::PARAM_INT);
        $sth->bindValue(':offset', isset($offset) ? (int) $offset : 0, \PDO::PARAM_INT);
        $sth->execute();
        $voteIds = array_column($sth->fetchAll(), 'id');

        if (!count($voteIds)) {
            return [];
        }

        $query = 'SELECT UNIX_TIMESTAMP(movie_vote.timestamp) as timestamp, movie_vote.vote AS vote, movie.*, genre.id AS genre_id, genre.name AS genre_name';

        if ($requesterUid) {
            $query .= ', friend_votes.vote AS friends_votes_val, 
            friend.id AS friends_votes_user_id, 
            friend.username AS friends_votes_user_name, 
            friend.avatar AS friends_votes_user_avatar,
            UNIX_TIMESTAMP(friend_votes.timestamp) AS friends_votes_timestamp, 
            IF (friend.id IS NOT NULL, CONCAT_WS(\'_\', movie.id, friend.id), NULL) AS friends_votes_group_id,
            IF (my_movie_vote.vote = \'2\', true, false) AS isLiked,
            IF (my_movie_vote.vote = \'1\', true, false) AS isNeutral,
            IF (my_movie_vote.vote = \'0\', true, false) AS isDisliked,
            IF (bookmark.timestamp is NULL, false, true) AS inBookmarks';
        }

        $query .= ' FROM movie_vote
        LEFT JOIN movie ON movie.id = movie_vote.movie_id
        LEFT JOIN movie_genre ON movie_genre.movie_id=movie.id
        LEFT JOIN genre ON genre.id=movie_genre.genre_id';

        if ($requesterUid) {
            $query .= ' LEFT JOIN movie_vote AS my_movie_vote ON my_movie_vote.movie_id = movie.id AND my_movie_vote.user_id = ' . $requesterUid . '
            LEFT JOIN bookmark ON (bookmark.user_id=' . $requesterUid . ' AND bookmark.movie_id=movie.id)
            LEFT JOIN movie_vote AS friend_votes ON friend_votes.movie_id = movie.id AND friend_votes.user_id IN (SELECT user_friends.user_2 FROM user_friends WHERE user_friends.user_1 = ' . $requesterUid . ' AND user_friends.subscribed = 1)
            LEFT JOIN `user` AS friend ON friend.id = friend_votes.user_id';
        }

        $query .= ' WHERE movie_vote.id IN(\'' . implode('\',\'', $voteIds) . '\') ORDER BY movie_vote.timestamp DESC';

        $sth = $this->pdo->prepare($query);
        $sth->execute();
        $rows = $sth->fetchAll();
        $movies = $this->app['mapper']->group($rows, 'id', [
            'id' => ['type' => 'int'],
            'likes' => ['type' => 'int'],
            'neutral' => ['type' => 'int'],
            'dislikes' => ['type' => 'int'],
            'isLiked' => ['type' => 'bool'],
            'isNeutral' => ['type' => 'bool'],
            'isDisliked' => ['type' => 'bool'],
            'inBookmarks' => ['type' => 'bool'],
            'tmdb_popularity' => ['type' => 'float'],
            'vote' => ['type' => 'int'],
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

        if ($requesterUid) {
            foreach ($movies as &$movie) {
                if (isset($movie['friend_votes']) && count($movie['friend_votes'])) {
                    usort($movie['friend_votes'], function($a, $b) {
                        return $b['vote_timestamp'] - $a['vote_timestamp'];
                    });
                }
            }
        }

        return $movies;
    }

    public function findByTmdbId($tmdbId, $userId = null) {
        $whereInString = '"' . implode('", "', $tmdbId) . '"';
        $query = 'SELECT movie.*, genre.id AS genre_id, genre.name AS genre_name, false as isLiked, false as isNeutral, false as isDisliked';
        if ($userId) {
            $query .= ', friend_votes.vote AS friends_votes_val,
            friend.id AS friends_votes_user_id,
            friend.username AS friends_votes_user_name,
            friend.avatar AS friends_votes_user_avatar,
            UNIX_TIMESTAMP(friend_votes.timestamp) AS friends_votes_timestamp,
            IF (friend.id IS NOT NULL, CONCAT_WS(\'_\', movie.id, friend.id), NULL) AS friends_votes_group_id,
            IF (movie_vote.vote = \'2\', true, false) AS isLiked,
            IF (movie_vote.vote = \'1\', true, false) AS isNeutral,
            IF (movie_vote.vote = \'0\', true, false) AS isDisliked,
            IF (bookmark.timestamp is NULL, false, true) AS inBookmarks';
        }

        $query .= ' FROM movie
            LEFT JOIN movie_genre ON movie_genre.movie_id=movie.id 
            LEFT JOIN genre ON genre.id=movie_genre.genre_id';
        if ($userId) {
            $query .= ' LEFT JOIN movie_vote ON movie_vote.movie_id=movie.id AND movie_vote.user_id=' . $userId . '
            LEFT JOIN bookmark ON (bookmark.user_id=' . $userId . ' AND bookmark.movie_id=movie.id)
            LEFT JOIN movie_vote AS friend_votes ON friend_votes.movie_id = movie.id AND friend_votes.user_id IN (SELECT user_friends.user_2 FROM user_friends WHERE user_friends.user_1 = ' . $userId . ' AND user_friends.subscribed = 1)
            LEFT JOIN `user` AS friend ON friend.id = friend_votes.user_id';
        }
        $query .= ' WHERE movie.tmdb_id IN (' . $whereInString . ') ORDER BY FIELD(movie.tmdb_id, ' . $whereInString . ')';

        $sth = $this->pdo->prepare($query);
        $sth->execute();
        $rows = $sth->fetchAll();

        $movies = $this->app['mapper']->group($rows, 'id', [
            'id' => ['type' => 'int'],
            'likes' => ['type' => 'int'],
            'neutral' => ['type' => 'int'],
            'dislikes' => ['type' => 'int'],
            'isLiked' => ['type' => 'bool'],
            'isNeutral' => ['type' => 'bool'],
            'isDisliked' => ['type' => 'bool'],
            'inBookmarks' => ['type' => 'bool'],
            'tmdb_popularity' => ['type' => 'float'],
            'kp_rating_count' => ['type' => 'int'],
            'imdb_rating_count' => ['type' => 'int'],
            'kp_rating_value' => ['type' => 'float'],
            'imdb_rating_value' => ['type' => 'float'],
            'genre_id' => ['group' => 'genres', 'group_id_field' => 'genre_id', 'rename' => 'id', 'type' => 'int'],
            'genre_name' => ['group' => 'genres', 'group_id_field' => 'genre_id', 'rename' => 'name'],

            'friends_votes_user_id' => ['group' => 'votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'user_id', 'type' => 'int'],
            'friends_votes_user_name' => ['group' => 'votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'user_name'],
            'friends_votes_user_avatar' => ['group' => 'votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'user_avatar'],
            'friends_votes_val' => ['group' => 'votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'value', 'type' => 'int'],
            'friends_votes_timestamp' => ['group' => 'votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'timestamp', 'type' => 'int']
        ]);

        if ($userId) {
            foreach ($movies as &$movie) {
                if (isset($movie['friend_votes']) && count($movie['friend_votes'])) {
                    usort($movie['friend_votes'], function($a, $b) {
                        return $b['vote_timestamp'] - $a['vote_timestamp'];
                    });
                }
            }
        }

        return $movies;
    }

    public function getTrends($limit = null, $userId = null) {
        $query = 'SELECT movie.*, genre.id AS genre_id, genre.name AS genre_name, false as isLiked, false as isNeutral, false as isDisliked';
        if ($userId) {
            $query .= ', friend_votes.vote AS friends_votes_val, 
            friend.id AS friends_votes_user_id, 
            friend.username AS friends_votes_user_name, 
            friend.avatar AS friends_votes_user_avatar,
            UNIX_TIMESTAMP(friend_votes.timestamp) AS friends_votes_timestamp, 
            IF (friend.id IS NOT NULL, CONCAT_WS(\'_\', movie.id, friend.id), NULL) AS friends_votes_group_id,
            IF (movie_vote.vote = \'2\', true, false) AS isLiked,
            IF (movie_vote.vote = \'1\', true, false) AS isNeutral,
            IF (movie_vote.vote = \'0\', true, false) AS isDisliked,
            IF (bookmark.timestamp is NULL, false, true) AS inBookmarks';
        }
        $query .= ' FROM 
            (SELECT 
                COUNT(*) AS sum_total,
                movie_vote.* FROM movie_vote
                GROUP BY movie_id 
                ORDER BY 
                    SUM(IF(movie_vote.timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY), 1, 0)) DESC,
                    SUM(IF(movie_vote.timestamp >= DATE_SUB(NOW(), INTERVAL 2 DAY), 1, 0)) DESC,
                    SUM(IF(movie_vote.timestamp >= DATE_SUB(NOW(), INTERVAL 3 DAY), 1, 0)) DESC,
                    SUM(IF(movie_vote.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY), 1, 0)) DESC,
                    sum_total DESC
                LIMIT :limit
            ) votes 
            LEFT JOIN movie ON movie.id = votes.movie_id
            LEFT JOIN movie_genre ON movie_genre.movie_id=movie.id 
            LEFT JOIN genre ON genre.id=movie_genre.genre_id';
        if ($userId) {
            $query .= ' LEFT JOIN movie_vote ON movie_vote.movie_id=movie.id AND movie_vote.user_id=:uid
            LEFT JOIN bookmark ON (bookmark.user_id=:uid AND bookmark.movie_id=movie.id)
            LEFT JOIN movie_vote AS friend_votes ON friend_votes.movie_id = movie.id AND friend_votes.user_id IN (SELECT user_friends.user_2 FROM user_friends WHERE user_friends.user_1 = :uid AND user_friends.subscribed = 1)
            LEFT JOIN `user` AS friend ON friend.id = friend_votes.user_id';
        }

        $sth = $this->pdo->prepare($query);
        if ($userId) {
            $sth->bindValue(':uid', (int) $userId, \PDO::PARAM_INT);
        }
        $sth->bindValue(':limit', isset($limit) ? (int) $limit : 18446744073709551615, \PDO::PARAM_INT);
        $sth->execute();
        $rows = $sth->fetchAll();

        $movies = $this->app['mapper']->group($rows, 'id', [
            'id' => ['type' => 'int'],
            'likes' => ['type' => 'int'],
            'neutral' => ['type' => 'int'],
            'dislikes' => ['type' => 'int'],
            'isLiked' => ['type' => 'bool'],
            'isNeutral' => ['type' => 'bool'],
            'isDisliked' => ['type' => 'bool'],
            'inBookmarks' => ['type' => 'bool'],
            'tmdb_popularity' => ['type' => 'float'],
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

        if ($userId) {
            foreach ($movies as &$movie) {
                if (isset($movie['friend_votes']) && count($movie['friend_votes'])) {
                    usort($movie['friend_votes'], function($a, $b) {
                        return $b['vote_timestamp'] - $a['vote_timestamp'];
                    });
                }
            }
        }

        return $movies;
    }

    public function getFilmsOrderedByVotes($limit = null, $userId = null, $onlyFriends = false) {

        $query = 'SELECT 
        movie.id as movie_id,
        movie.type as movie_type,
        movie.title AS movie_title, 
        movie.original_title AS movie_original_title, 
        movie.tmdb_poster_path AS movie_tmdb_poster_path, 
        movie.release_date AS movie_release_date, 
        movie.first_air_date AS movie_first_air_date, 
        movie.tmdb_overview AS movie_tmdb_overview, 
        movie.original_language AS movie_original_language, 
        movie.tmdb_popularity AS movie_tmdb_popularity, 
        movie.likes AS movie_likes, 
        movie.neutral AS movie_neutral, 
        movie.dislikes AS movie_dislikes,
        movie.kp_rating_value AS movie_kp_rating_value,
        movie.imdb_rating_value AS movie_imdb_rating_value,
        genre.id AS movie_genre_id, 
        genre.name AS movie_genre_name,
        UNIX_TIMESTAMP(votes.timestamp) as vote_timestamp,
        votes.vote as vote_val,
        `user`.id as vote_user_id,
        `user`.username as vote_user_username,
        `user`.avatar as vote_user_avatar,
        CONCAT_WS(\'_\', `user`.id, movie.id) AS votes_field_group';

        if ($userId) {
            $query .= ', IF (my_mote.vote = \'2\', true, false) AS movie_isLiked,
            IF (my_mote.vote = \'1\', true, false) AS movie_isNeutral,
            IF (my_mote.vote = \'0\', true, false) AS movie_isDisliked,
            IF (bookmark.timestamp is NULL, false, true) AS movie_inBookmarks';
        }

        if ($onlyFriends) {
            $query .= ' FROM (SELECT movie_vote.movie_id FROM movie_vote WHERE movie_vote.user_id IN 
            (SELECT user_friends.user_2 FROM user_friends WHERE user_1 = :uid) 
            GROUP BY movie_id DESC ORDER BY max(`timestamp`) DESC LIMIT :limit) mv';
        } else {
            $query .= ' FROM (SELECT movie_vote.movie_id FROM movie_vote GROUP BY movie_id DESC ORDER BY max(`timestamp`) DESC LIMIT :limit) mv';
        }

        $query .= ' LEFT JOIN movie ON movie.id = mv.movie_id
        LEFT JOIN movie_genre ON movie_genre.movie_id=movie.id
        LEFT JOIN genre ON genre.id=movie_genre.genre_id';

        if ($onlyFriends) {
            $query .= ' LEFT JOIN (SELECT movie_vote.* FROM movie_vote WHERE movie_vote.user_id IN (SELECT user_friends.user_2 FROM user_friends WHERE user_1 = :uid)) votes ON votes.movie_id = mv.movie_id
            LEFT JOIN `user` ON `user`.id = votes.user_id';
        } else {
            $query .= ' LEFT JOIN movie_vote AS votes ON votes.movie_id = mv.movie_id
            LEFT JOIN `user` ON `user`.id = votes.user_id';
        }

        if ($userId) {
            $query .= ' LEFT JOIN movie_vote AS my_mote ON my_mote.movie_id=movie.id AND my_mote.user_id=:uid
            LEFT JOIN bookmark ON (bookmark.user_id=:uid AND bookmark.movie_id=movie.id)';
        }

        $sth = $this->pdo->prepare($query);
        if ($userId) {
            $sth->bindValue(':uid', (int) $userId, \PDO::PARAM_INT);
        }
        $sth->bindValue(':limit', isset($limit) ? (int) $limit : 18446744073709551615, \PDO::PARAM_INT);
        $sth->execute();
        $rows = $sth->fetchAll();

        $movies = $this->app['mapper']->group($rows, 'movie_id', [
            'movie_id' => ['type' => 'int', 'rename' => 'id'],
            'movie_type' => ['rename' => 'type'],
            'movie_title' => ['rename' => 'title'],
            'movie_original_title' => ['rename' => 'original_title'],
            'movie_tmdb_poster_path' => ['rename' => 'tmdb_poster_path'],
            'movie_release_date' => ['rename' => 'release_date'],
            'movie_first_air_date' => ['rename' => 'first_air_date'],
            'movie_tmdb_overview' => ['rename' => 'tmdb_overview'],
            'movie_original_language' => ['rename' => 'original_language'],
            'movie_tmdb_popularity' => ['type' => 'float', 'rename' => 'tmdb_popularity'],
            'movie_likes' => ['type' => 'int', 'rename' => 'likes'],
            'movie_neutral' => ['type' => 'int', 'rename' => 'neutral'],
            'movie_dislikes' => ['type' => 'int', 'rename' => 'dislikes'],
            'movie_kp_rating_value' => ['type' => 'float', 'rename' => 'kp_rating_value'],
            'movie_imdb_rating_value' => ['type' => 'float', 'rename' => 'imdb_rating_value'],
            'movie_isLiked' => ['type' => 'bool', 'rename' => 'isLiked'],
            'movie_isNeutral' => ['type' => 'bool', 'rename' => 'isNeutral'],
            'movie_isDisliked' => ['type' => 'bool', 'rename' => 'isDisliked'],
            'movie_inBookmarks' => ['type' => 'bool', 'rename' => 'inBookmarks'],

            'movie_genre_id' => ['group' => 'genres', 'group_id_field' => 'movie_genre_id', 'rename' => 'id', 'type' => 'int'],
            'movie_genre_name' => ['group' => 'genres', 'group_id_field' => 'movie_genre_id', 'rename' => 'name'],

            'vote_timestamp' => ['group' => 'votes', 'group_id_field' => 'votes_field_group', 'rename' => 'timestamp', 'type' => 'int'],
            'vote_val' => ['group' => 'votes', 'group_id_field' => 'votes_field_group', 'rename' => 'value', 'type' => 'int'],
            'vote_user_id' => ['group' => 'votes', 'group_id_field' => 'votes_field_group', 'rename' => 'user_id', 'type' => 'int'],
            'vote_user_username' => ['group' => 'votes', 'group_id_field' => 'votes_field_group', 'rename' => 'user_name'],
            'vote_user_avatar' => ['group' => 'votes', 'group_id_field' => 'votes_field_group', 'rename' => 'user_avatar']
        ]);

        if (count($movies)) {
            foreach ($movies as &$movie) {
                unset($movie['votes_field_group']);

                if (isset($movie['votes']) && count($movie['votes'])) {
                    usort($movie['votes'], function($a, $b) {
                        return $b['timestamp'] - $a['timestamp'];
                    });
                }
            }
        }

        return $movies;
    }
}