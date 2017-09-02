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
            CONCAT_WS(\'_\', people.id, `group`.id) AS people_field_group, people.id AS people_id, people.name AS people_name, people.original_name AS people_original_name, people.kp_photo AS people_photo, movie_people.order AS people_order, movie_people.description AS people_description, `group`.type AS people_group_type, `group`.title AS people_group_title';
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
            LEFT JOIN genre ON genre.id=movie_genre.genre_id
            
            LEFT JOIN movie_country ON movie_country.movie_id=movie.id 
            LEFT JOIN country ON country.id=movie_country.country_id
            
            LEFT JOIN movie_people ON movie_people.movie_id=movie.id 
            LEFT JOIN people ON people.id=movie_people.people_id
            LEFT JOIN `group` ON `group`.id=movie_people.group_id';
        if ($userId) {
            $query .= ' LEFT JOIN movie_vote ON movie_vote.movie_id=movie.id AND movie_vote.user_id=' . $userId . '
            LEFT JOIN bookmark ON (bookmark.user_id=' . $userId . ' AND bookmark.movie_id=movie.id)
            LEFT JOIN movie_vote AS friend_votes ON friend_votes.movie_id = movie.id AND friend_votes.user_id IN (SELECT user_friends.user_2 FROM user_friends WHERE user_friends.user_1 = ' . $userId . ' AND user_friends.subscribed = 1)
            LEFT JOIN `user` AS friend ON friend.id = friend_votes.user_id';
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

            'friends_votes_user_id' => ['group' => 'friend_votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'user_id', 'type' => 'int'],
            'friends_votes_user_name' => ['group' => 'friend_votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'user_name'],
            'friends_votes_user_avatar' => ['group' => 'friend_votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'user_avatar'],
            'friends_votes_val' => ['group' => 'friend_votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'vote', 'type' => 'int'],
            'friends_votes_timestamp' => ['group' => 'friend_votes', 'group_id_field' => 'friends_votes_group_id', 'rename' => 'vote_timestamp', 'type' => 'int']
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

        return $movie;
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
}