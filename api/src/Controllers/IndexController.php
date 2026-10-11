<?php

namespace Controllers;

use GuzzleHttp\Exception\ClientException;
use GuzzleHttp\Exception\TransferException;
use Services\TMDBServiceProvider;
use Silex\Application;
use Symfony\Component\HttpFoundation\Request;

class IndexController
{
    public function index(Request $request, Application $app)
    {
        return $app->json(['version' => '0.0.1']);
    }

    public function search(Request $request, Application $app)
    {
        $uid = $request->headers->get('uid');
        $token = $request->headers->get('access-token');

        $user = $app['user.repository']->getByCredentials($uid, $token);

        $query = $request->get('query');

        /**
         * @var $tmdb TMDBServiceProvider
         */
        $tmdb = $app['tmdb'];
        $tmdbResponse = $tmdb->multiSearch($query);

        /**
         * @var $pdo \PDO
         */
        $pdo = $app['pdo'];

        $sthMovie = $pdo->prepare('
        INSERT INTO movie (`tmdb_id`, `type`, `title`, `original_title`, `tmdb_poster_path`, `release_date`, `first_air_date`, `tmdb_overview`, `original_language`, `tmdb_popularity`) 
        VALUES (:tmdb_id, :type, :title, :original_title, :tmdb_poster_path, :release_date, :first_air_date, :tmdb_overview, :original_language, :tmdb_popularity) 
        ON DUPLICATE KEY UPDATE tmdb_popularity=:tmdb_popularity');

        if ($tmdbResponse->total_results == 0) {
            return $app->json([
                'total' => 0,
                'results' => []
            ]);
        }

        $updateGenres = function ($genres) use ($pdo) {
            $pdo->query('
                    INSERT IGNORE INTO genre (`tmdb_id`) 
                    VALUES (' . implode('), (', $genres) . ')');

            $sth = $pdo->query('SELECT * FROM genre WHERE tmdb_id IN (' . implode(',', $genres) . ')');
            return $sth->fetchAll();
        };

        // insert movies and tv
        $tmdbMoviesIds = [];
        foreach ($tmdbResponse->results as $entity) {
            if ($entity->media_type === 'person') {
                continue;
            }

            $tmdbMoviesIds[] = $entity->media_type . '_' . $entity->id;

            $title = $entity->media_type === 'movie' ? $entity->title : $entity->name;
            $original_title = $entity->media_type === 'movie' ? ($entity->original_title ?: null) : ($entity->original_name ?: null);
            $release_date = ($entity->media_type === 'movie' && isset($entity->release_date)) ? $entity->release_date : null;
            $first_air_date = ($entity->media_type === 'tv' && isset($entity->first_air_date)) ? $entity->first_air_date : null;

            $sthMovie->execute([
                'tmdb_id' => $entity->media_type . '_' . $entity->id,
                'type' => $entity->media_type,
                'title' => $title,
                'original_title' => $original_title,
                'tmdb_poster_path' => $entity->poster_path,
                'release_date' => $release_date,
                'first_air_date' => $first_air_date,
                'tmdb_overview' => $entity->overview,
                'original_language' => $entity->original_language,
                'tmdb_popularity' => $entity->popularity
            ]);

            // insert genres
            if (count($entity->genre_ids)) {
                $movieId = $pdo->query('SELECT id FROM movie WHERE tmdb_id=\'' . ($entity->media_type . '_' . $entity->id) . '\'')->fetchColumn();
                $genresData = array_map(function ($genre) use ($movieId) {
                    return '(' . $movieId . ',' . $genre['id'] . ')';
                }, $updateGenres($entity->genre_ids));
                $pdo->query('INSERT IGNORE INTO movie_genre (`movie_id`, `genre_id`) VALUES ' . implode(', ', $genresData))->execute();
            }
        }

        $movies = $app['movie.repository']->findByTmdbId($tmdbMoviesIds, $user ? $user['id'] : null);
        return $app->json([
            'total' => count($movies),
            'results' => $movies
        ]);
    }

    public function getTrends(Request $request, Application $app)
    {
        $uid = $request->headers->get('uid');
        $token = $request->headers->get('access-token');

        $user = $app['user.repository']->getByCredentials($uid, $token);

        $totalSth = $app['pdo']->query('SELECT COUNT(DISTINCT movie_id) AS num FROM movie_vote');
        $total = intval($totalSth->fetch()['num']);

        if ($total == 0) {
            return $app->json([
                'success' => true,
                'results' => [
                    'total' => $total,
                    'entities' => []
                ]
            ]);
        }

        $movies = $app['movie.repository']->getTrends(TRENDS_LIST_SIZE, $user ? $user['id'] : null);

        return $app->json([
            'success' => true,
            'results' => [
                'total' => $total,
                'entities' => $movies
            ]
        ]);
    }

    public function getFilm(Request $request, Application $app)
    {
        $mid = $request->get('mid');

        if (!isset($mid)) {
            return $app->json([
                'success' => false,
                'msg' => 'Not found'
            ], 404);
        }

        $uid = $request->headers->get('uid');
        $token = $request->headers->get('access-token');

        $user = $app['user.repository']->getByCredentials($uid, $token);

        $movie = $app['movie.repository']->getFilm($mid, $user ? $user['id'] : null);

        if (!$movie) {
            return $app->json([
                'success' => false,
                'msg' => 'Not found'
            ], 404);
        }

        if (is_null($movie['tmdb_trailers'])) {
            $tmdb = $app['tmdb'];
            $mapTrailers = function ($trailer) {
                return $trailer->site . ':' . $trailer->key;
            };

            try {
                $tmdbResponse = $tmdb->getMovie($movie['tmdb_id']);
                $trailers = array_map($mapTrailers, $tmdbResponse->videos->results);
            } catch (ClientException $e) {
                // removed from TMDb (404): remember that there are no trailers; other 4xx (e.g. a bad
                // API key) must not be cached as "no trailers"
                $trailers = 404 === $e->getResponse()->getStatusCode() ? array() : null;
            } catch (TransferException $e) {
                // TMDb or the proxy is unreachable: show the film now, try again next time
                $trailers = null;
            }

            $movie['tmdb_trailers'] = $trailers ?: array();

            if (null !== $trailers) {
                /**
                 * @var $pdo \PDO
                 */
                $pdo = $app['pdo'];

                $sthMovie = $pdo->prepare('UPDATE movie SET `tmdb_trailers`=:trailers WHERE `id`=:id;');

                $sthMovie->execute([
                    'id' => $movie['id'],
                    'trailers' => json_encode($trailers)
                ]);
            }
        } else {
            $movie['tmdb_trailers'] = json_decode($movie['tmdb_trailers']);
        }

        return $app->json([
            'success' => true,
            'movie' => $movie
        ]);
    }

    public function getFilmVotes(Request $request, Application $app)
    {
        $mid = $request->get('mid');

        if (!isset($mid)) {
            return $app->json([
                'success' => false,
                'msg' => 'Not found'
            ], 404);
        }

        $uid = $request->headers->get('uid');
        $token = $request->headers->get('access-token');

        $user = $app['user.repository']->getByCredentials($uid, $token);

        $votes = $app['movie.repository']->getFilmVotes($mid, $user ? $user['id'] : null);

        return $app->json([
            'success' => true,
            'movie_id' => intval($mid),
            'votes' => $votes
        ]);
    }

    public function updateAndGetPoster(Request $request, Application $app)
    {
        $mid = $request->get('mid');

        if (!isset($mid)) {
            return $app->json([
                'success' => false,
                'msg' => 'Not found'
            ], 404);
        }

        $movie = $app['movie.repository']->getFilm($mid, null);

        if (!$movie) {
            return $app->json([
                'success' => false,
                'msg' => 'Not found'
            ], 404);
        }

        $tmdb = $app['tmdb'];
        try {
            $tmdbResponse = $tmdb->getMovie($movie['tmdb_id']);
        } catch (TransferException $e) {
            // gone from TMDb or TMDb unreachable: keep the poster we have
            $tmdbResponse = null;
        }

        if ($tmdbResponse && $tmdbResponse->poster_path) {
            /**
             * @var $pdo \PDO
             */
            $pdo = $app['pdo'];
            $sthMovie = $pdo->prepare('UPDATE movie SET `tmdb_poster_path`=:poster WHERE `id`=:id;');

            $sthMovie->execute([
                'id' => $movie['id'],
                'poster' => $tmdbResponse->poster_path
            ]);

            return $app->json([
                'success' => true,
                'movie_id' => $mid,
                'poster_path' => $tmdbResponse->poster_path
            ]);
        }

        return $app->json([
            'success' => true,
            'movie_id' => $mid,
            'poster_path' => $movie['tmdb_poster_path']
        ]);
    }

    public function getPerson(Request $request, Application $app)
    {
        $pid = $request->get('pid');

        if (!isset($pid)) {
            return $app->json([
                'success' => false,
                'msg' => 'Not found'
            ], 404);
        }

        $uid = $request->headers->get('uid');
        $token = $request->headers->get('access-token');

        $user = $app['user.repository']->getByCredentials($uid, $token);

        $person = $app['person.repository']->getPerson($pid, $user ? $user['id'] : null);

        if (!$person) {
            return $app->json([
                'success' => false,
                'msg' => 'Not found'
            ], 404);
        }

        return $app->json([
            'success' => true,
            'person' => $person
        ]);
    }

    public function getVotes(Request $request, Application $app)
    {
        $uid = $request->get('uid');

        $requesterUid = $request->headers->get('uid');
        $requesterToken = $request->headers->get('access-token');

        $requester = $app['user.repository']->getByCredentials($requesterUid, $requesterToken);

        if (!$uid) {
            if (!$requester) {
                return $app->json([
                    'success' => false,
                    'msg' => 'Access denied'
                ]);
            }
        } else {
            if (!$app['user.repository']->findById($uid)) {
                return $app->json([
                    'success' => false,
                    'msg' => 'Not found'
                ], 404);
            }
        }

        /**
         * @var $pdo \PDO
         */
        $pdo = $app['pdo'];

        $size = $request->get('size') ? $request->get('size') : VOTES_LIST_SIZE;
        $page = $request->get('page') ? $request->get('page') : 1;

        $totalSth = $pdo->prepare('SELECT COUNT(*) AS num FROM movie_vote m WHERE user_id = :uid');
        $totalSth->execute(['uid' => $uid]);
        $total = intval($totalSth->fetch()['num']);

        if ($total == 0) {
            return $app->json([
                'success' => true,
                'results' => [
                    'total' => $total,
                    'page' => (int)$page,
                    'pages' => ceil($total / $size),
                    'entities' => []
                ]
            ]);
        }

        return $app->json([
            'success' => true,
            'results' => [
                'total' => (int)$total,
                'page' => (int)$page,
                'pages' => ceil($total / $size),
                'entities' => $app['movie.repository']->findByUserId($requesterUid, $uid, $size, ($page - 1) * $size)
            ]
        ]);
    }

    public function updateGenres(Request $request, Application $app)
    {
        /**
         * @var $tmdb TMDBServiceProvider
         */
        $tmdb = $app['tmdb'];
        $tmdbResponseMovie = $tmdb->getMovieGenres();
        $tmdbResponseTv = $tmdb->getTvGenres();
        $tmdbGenres = array_merge($tmdbResponseTv->genres, $tmdbResponseMovie->genres);

        /**
         * @var $pdo \PDO
         */
        $pdo = $app['pdo'];

        $sth = $pdo->prepare('
        INSERT INTO genre (`tmdb_id`, `name`) 
        VALUES (:tmdb_id, :name)
        ON DUPLICATE KEY UPDATE name=:name');

        foreach ($tmdbGenres as $genre) {
            $sth->execute([
                    'tmdb_id' => $genre->id,
                    'name' => $genre->name,
                ]
            );
        }

        $sth = $pdo->query('SELECT * FROM genre');

        return $app->json($sth->fetchAll());
    }

    public function getLastGradedFilms(Request $request, Application $app)
    {
        $uid = $request->headers->get('uid');
        $token = $request->headers->get('access-token');

        $user = $app['user.repository']->getByCredentials($uid, $token);

        $page = $request->get('page') ? $request->get('page') : 1;
        $limit = $request->get('page') ? $request->get('page') * HOME_LIST_SIZE : HOME_LIST_SIZE;

        if ($user && $user['hide_viewed']) {
            $totalSth = $app['pdo']->prepare('SELECT COUNT(*) AS num FROM(SELECT * FROM movie_vote WHERE user_id <> :uid GROUP BY movie_id ORDER BY movie_id DESC) mv');
            $totalSth->execute(['uid' => $user['id']]);
        } else {
            $totalSth = $app['pdo']->query('SELECT COUNT(*) AS num FROM(SELECT * FROM movie_vote GROUP BY movie_id ORDER BY movie_id DESC) mv');
        }
        $total = intval($totalSth->fetch()['num']);

        if ($total == 0) {
            return $app->json([
                'success' => true,
                'results' => [
                    'total' => $total,
                    'page' => (int)$page,
                    'pages' => ceil($total / HOME_LIST_SIZE),
                    'entities' => []
                ]
            ]);
        }

        $movies = $app['movie.repository']->getFilmsOrderedByVotes($limit, $user);

        return $app->json([
            'success' => true,
            'results' => [
                'total' => $total,
                'page' => (int)$page,
                'pages' => ceil($total / HOME_LIST_SIZE),
                'entities' => $movies
            ]
        ]);
    }

    public function getLastGradedFilmsFriends(Request $request, Application $app)
    {
        $uid = $request->headers->get('uid');
        $token = $request->headers->get('access-token');

        $user = $app['user.repository']->getByCredentials($uid, $token);

        if (!$user) {
            return $app->json([
                'success' => false,
                'msg' => 'authorization required'
            ], 401);
        }

        $page = $request->get('page') ? $request->get('page') : 1;
        $limit = $request->get('page') ? $request->get('page') * HOME_LIST_SIZE : HOME_LIST_SIZE;

        if ($user && $user['hide_viewed']) {
            $totalSth = $app['pdo']->prepare('SELECT COUNT(*) AS num FROM(SELECT * FROM movie_vote WHERE user_id <> :uid AND movie_vote.user_id IN (SELECT user_friends.user_2 FROM user_friends WHERE user_1 = :uid) GROUP BY movie_id ORDER BY movie_id DESC) mv');
            $totalSth->execute(['uid' => $user['id']]);
        } else {
            $totalSth = $app['pdo']->prepare('SELECT COUNT(*) AS num FROM(SELECT * FROM movie_vote WHERE movie_vote.user_id IN (SELECT user_friends.user_2 FROM user_friends WHERE user_1 = :uid) GROUP BY movie_id ORDER BY movie_id DESC) mv');
        }
        $totalSth->execute(['uid' => $user['id']]);
        $total = intval($totalSth->fetch()['num']);

        if ($total == 0) {
            return $app->json([
                'success' => true,
                'results' => [
                    'total' => $total,
                    'page' => (int)$page,
                    'pages' => ceil($total / HOME_LIST_SIZE),
                    'entities' => []
                ]
            ]);
        }

        $movies = $app['movie.repository']->getFilmsOrderedByVotes($limit, $user, true);

        return $app->json([
            'success' => true,
            'results' => [
                'total' => $total,
                'page' => (int)$page,
                'pages' => ceil($total / HOME_LIST_SIZE),
                'entities' => $movies
            ]
        ]);
    }

    public function getDigitalFilms(Request $request, Application $app)
    {
        /**
         * @var $pdo \PDO
         */
        $pdo = $app['pdo'];

        $uid = $request->headers->get('uid');
        $token = $request->headers->get('access-token');
        $quality = $request->get('quality') ? array_filter(explode(',', $request->get('quality')), 'is_numeric') : null;
        $voice = $request->get('voice') ?  array_filter(explode(',', $request->get('voice')), 'is_numeric') : null;
        $ratingValue = $request->get('kp_rating_value');
        $ratingCount = $request->get('kp_rating_count');
        $dateFrom = $request->get('date_from');
        $dateTo = $request->get('date_to');

        $user = $app['user.repository']->getByCredentials($uid, $token);

        $page = $request->get('page') ? $request->get('page') : 1;
        $offset = ($page - 1) * DIGITAL_LIST_SIZE;

        $selectFrom = 'SELECT min(t2.created) AS created, t2.id FROM ft_torrent t2 INNER JOIN ft_film_torrent ft ON ft.torrent_id = t2.id';
        if ($quality || $voice) {
            $selectFrom .= ' WHERE ';

            if ($quality) {
                $selectFrom .= ' t2.quality IN(' . implode(',', $quality) . ')';
            }
            if ($voice) {
                $selectFrom .= $quality ? ' AND' : '';
                $selectFrom .= ' t2.voice IN(' . implode(',', $voice) . ')';
            }
        }
        $selectFrom .= ' GROUP BY ft.film_id';

        $joins = 'LEFT JOIN ft_film_torrent ft ON ft.torrent_id = t.id LEFT JOIN ft_film f ON f.id = ft.film_id RIGHT JOIN movie m_m ON m_m.kp_id = f.kp_id';
        $where = 'WHERE t.created IS NOT NULL AND m_m.kp_rating_value >= :ratingValue AND m_m.kp_rating_count >= :ratingCount';
        $where .= ' AND m_m.release_date >= :dateFrom AND m_m.release_date <= :dateTo';
        $order = 'ORDER BY created DESC, m_m.tmdb_id DESC';

//        if ($user && $user['hide_viewed']) {
//            $totalSth = $app['pdo']->prepare('SELECT COUNT(*) AS num FROM(SELECT * FROM movie_vote WHERE user_id <> :uid AND movie_vote.user_id IN (SELECT user_friends.user_2 FROM user_friends WHERE user_1 = :uid) GROUP BY movie_id ORDER BY movie_id DESC) mv');
//            $totalSth->execute(['uid' => $user['id']]);
//        } else {
//            $totalSth = $app['pdo']->prepare('SELECT COUNT(*) AS num FROM(SELECT * FROM movie_vote WHERE movie_vote.user_id IN (SELECT user_friends.user_2 FROM user_friends WHERE user_1 = :uid) GROUP BY movie_id ORDER BY movie_id DESC) mv');
//        }

        $pRatingValue = isset($ratingValue) ? (float) $ratingValue : 0;
        $pRatingCount = isset($ratingCount) ? (int) $ratingCount : 0;
        $pDateFrom = isset($dateFrom) && isset(explode("-", $dateFrom)[0]) && isset(explode("-", $dateFrom)[1]) ? $dateFrom : "0";
        $pDateTo = isset($dateFrom) && isset(explode("-", $dateTo)[0]) && isset(explode("-", $dateTo)[1]) ? $dateTo : "9999";

        $totalSth = $pdo->prepare('SELECT COUNT(*) as num FROM (' . $selectFrom . ') t ' . $joins . ' ' . $where);
        $totalSth->bindValue(':ratingValue', $pRatingValue, \PDO::PARAM_STR);
        $totalSth->bindValue(':ratingCount', $pRatingCount, \PDO::PARAM_INT);
        $totalSth->bindValue(':dateFrom', $pDateFrom, \PDO::PARAM_STR);
        $totalSth->bindValue(':dateTo', $pDateTo, \PDO::PARAM_STR);
        $totalSth->execute();
        $total = intval($totalSth->fetch()['num']);

        $sthTmdbIds = $pdo->prepare(' SELECT m_m.tmdb_id FROM (' . $selectFrom . ') t ' . $joins . ' ' . $where . ' ' . $order . ' LIMIT :limit OFFSET :offset');
        $sthTmdbIds->bindValue(':ratingValue', $pRatingValue, \PDO::PARAM_STR);
        $sthTmdbIds->bindValue(':ratingCount', $pRatingCount, \PDO::PARAM_INT);
        $sthTmdbIds->bindValue(':dateFrom', $pDateFrom, \PDO::PARAM_STR);
        $sthTmdbIds->bindValue(':dateTo', $pDateTo, \PDO::PARAM_STR);
        $sthTmdbIds->bindValue(':limit', DIGITAL_LIST_SIZE, \PDO::PARAM_INT);
        $sthTmdbIds->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $sthTmdbIds->execute();
        $tmdbIds = array_column($sthTmdbIds->fetchAll(), 'tmdb_id');

        return $app->json([
            'success' => true,
            'results' => [
                'total' => $total,
                'page' => (int)$page,
                'pages' => ceil($total / HOME_LIST_SIZE),
                'sth' => $sthTmdbIds->queryString,
                'entities' => count($tmdbIds) ? $app['movie.repository']->findByTmdbId($tmdbIds, $user ? $user['id'] : null) : []
            ]
        ]);
    }

    public function getDatasets(Request $request, Application $app)
    {
        /**
         * @var $pdo \PDO
         */
        $pdo = $app['pdo'];

        $qualitySth = $pdo->prepare('SELECT * FROM ft_quality');
        $qualitySth->execute();

        $voiceSth = $pdo->prepare('SELECT * FROM ft_voice ORDER BY sort DESC');
        $voiceSth->execute();

        return $app->json([
            'success' => true,
            'results' => [
                'quality' => $qualitySth->fetchAll(),
                'voice' => $voiceSth->fetchAll(),
            ]
        ]);
    }
}