<?php

namespace Repositories;

use Silex\Application;

class PersonRepository {
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

    public function getPerson($id, $userId = null) {
        $queryPeople = 'SELECT people.* FROM people WHERE id = :id';
        $sth = $this->pdo->prepare($queryPeople);
        $sth->execute(['id' => $id]);
        $person = $sth->fetch();

        if (!count($person)) {
            return null;
        }

        $queryMovie = 'SELECT
        `group`.id AS movie_group_id,
        `group`.title_singular AS movie_group_title,
        movie_people.movie_id as movie_id,
        movie.id AS movie_id,
        movie.type AS movie_type,
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
        UNIX_TIMESTAMP(votes.timestamp) as vote_timestamp,
        votes.vote as vote_val,
        `user`.id as vote_user_id,
        `user`.username as vote_user_username,
        `user`.avatar as vote_user_avatar';

        if ($userId) {
            $queryMovie .= ', IF (my_movie_vote.vote = \'2\', true, false) AS movie_isLiked,
            IF (my_movie_vote.vote = \'1\', true, false) AS movie_isNeutral,
            IF (my_movie_vote.vote = \'0\', true, false) AS movie_isDisliked,
            IF (bookmark.timestamp is NULL, false, true) AS movie_inBookmarks';
        }

        $queryMovie .= ' FROM movie_people 
            LEFT JOIN movie ON movie.id = movie_people.movie_id
            LEFT JOIN `group` ON `group`.id=movie_people.group_id
            LEFT JOIN movie_vote AS votes ON votes.movie_id = movie.id
            LEFT JOIN `user` ON `user`.id = votes.user_id';

        if ($userId) {
            $queryMovie .= ' 
            LEFT JOIN movie_vote AS my_movie_vote ON my_movie_vote.movie_id = movie.id AND my_movie_vote.user_id = ' . $userId . '
            LEFT JOIN bookmark ON (bookmark.user_id=1 AND bookmark.movie_id=movie.id)';
        }
        $queryMovie .= ' WHERE people_id = ' . $id . ' ORDER BY IF(movie_type = \'movie\', movie_release_date, movie_first_air_date) DESC';

        $sth = $this->pdo->prepare($queryMovie);
        $sth->execute();
        $rows = $sth->fetchAll();

        if (!count($rows)) {
            return null;
        }

        $movies = $this->app['mapper']->group($rows, ['movie_id', 'movie_group_id'], [
            'movie_id' => ['type' => 'int', 'rename' => 'id'],
            'movie_group_id' => ['type' => 'int', 'rename' => 'group_id'],
            'movie_group_title' => ['type' => 'string', 'rename' => 'group_title'],
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

            'vote_timestamp' => ['group' => 'votes', 'group_id_field' => ['movie_id', 'vote_user_id'], 'rename' => 'timestamp', 'type' => 'int'],
            'vote_val' => ['group' => 'votes', 'group_id_field' => ['movie_id', 'vote_user_id'], 'rename' => 'value', 'type' => 'int'],
            'vote_user_id' => ['group' => 'votes', 'group_id_field' => ['movie_id', 'vote_user_id'], 'rename' => 'user_id', 'type' => 'int'],
            'vote_user_username' => ['group' => 'votes', 'group_id_field' => ['movie_id', 'vote_user_id'], 'rename' => 'user_name'],
            'vote_user_avatar' => ['group' => 'votes', 'group_id_field' => ['movie_id', 'vote_user_id'], 'rename' => 'user_avatar']
        ]);

        unset($person['kp_id']);

        if (count($movies)) {
            foreach ($movies as &$movie) {
                if (isset($movie['votes']) && count($movie['votes'])) {
                    usort($movie['votes'], function($a, $b) {
                        return $b['timestamp'] - $a['timestamp'];
                    });
                }
            }
        }

        $person['movies'] = $movies;
        return $person;
    }
}