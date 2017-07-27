<?php

namespace Controllers;

use Aws\Api\DateTimeResult;
use Exception;
use Services\TMDBServiceProvider;
use Silex\Application;
use Symfony\Component\HttpFoundation\Request;

class IndexController
{
    public function index(Request $request, Application $app)
    {
        return $app->json(['version'=>'0.0.1']);
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

    public function toggleVote(Request $request, Application $app)
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

        /**
         * @var $pdo \PDO
         */
        $pdo = $app['pdo'];

        $entityId = $request->get('id');
        $action = $request->get('vote');
        $actionId = $action === 'like' ? 2 : ($action === 'dislike' ? 0 : 1);

        $currentVote = $pdo->prepare('SELECT * FROM movie_vote WHERE movie_id=:entityId AND user_id=:userId');
        $currentVote->execute([
            'entityId' => $entityId,
            'userId' => $user['id']
        ]);
        $currentVote = $currentVote->fetch();

        $pdo->beginTransaction();
        $query = null;
        try {
            if ($currentVote) {
                $pdo->prepare('DELETE FROM movie_vote WHERE movie_id=:entityId AND user_id=:userId')->execute([
                    'entityId' => $entityId,
                    'userId' => $user['id']
                ]);
            }
            if (!$currentVote || $actionId != $currentVote['vote']) {
                $pdo->prepare('INSERT INTO movie_vote (`movie_id`, `user_id`, `vote`) VALUES (:entityId, :userId, :vote)')->execute([
                    'entityId' => $entityId,
                    'userId' => $user['id'],
                    'vote' => $actionId
                ]);
            }

            $query = 'UPDATE movie';
            if ($currentVote) {
                $col = $currentVote['vote'] == 2 ? 'likes' : ($currentVote['vote'] == 0 ? 'dislikes' : 'neutral');
                $query .= ' SET ' . $col . '=' . $col . '-1';
            }
            if (!$currentVote || $actionId != $currentVote['vote']) {
                $col = $actionId === 2 ? 'likes' : ($actionId === 0 ? 'dislikes' : 'neutral');
                $query .= ($currentVote ? ', ' : ' SET ') . $col . '=' . $col . '+1';
            }
            $query .= ' WHERE id=:entityId';
            $pdo->prepare($query)->execute([
                'entityId' => $entityId
            ]);

            $pdo->commit();
        } catch(Exception $e){
            $pdo->rollBack();
            return $app->json([
                'success' => false,
                'msg' => 'something went wrong',
                'error' => $e
            ], 500);
        }

        $entitySth = $pdo->prepare('SELECT id, likes, dislikes, neutral FROM movie WHERE id=:entityId');
        $entitySth->execute([
            'entityId' => $entityId
        ]);
        $entityData = $entitySth->fetch();

        return $app->json([
            'success' => true,
            'data' => [
                'id' => intval($entityData['id']),
                'likes' => intval($entityData['likes']),
                'neutral' => intval($entityData['neutral']),
                'dislikes' => intval($entityData['dislikes']),
                'isLiked' => (!$currentVote || $currentVote['vote'] != $actionId) && $actionId === 2,
                'isNeutral' => (!$currentVote || $currentVote['vote'] != $actionId) && $actionId === 1,
                'isDisliked' => (!$currentVote || $currentVote['vote'] != $actionId) && $actionId === 0,
            ]
        ]);
    }

    public function getNotifications(Request $request, Application $app)
    {
        return $app->json([
            'payload' => [
                'time' => new DateTimeResult()
            ]
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
                    'page' => (int) $page,
                    'pages' => ceil($total / $size),
                    'entities' => []
                ]
            ]);
        }

        return $app->json([
            'success' => true,
            'results' => [
                'total' => (int) $total,
                'page' => (int) $page,
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
}