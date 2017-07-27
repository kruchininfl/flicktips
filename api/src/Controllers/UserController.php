<?php

namespace Controllers;

use Silex\Application;
use Symfony\Component\HttpFoundation\Request;

class UserController
{
    public function validateToken(Request $request, Application $app)
    {
        $uid = $request->headers->get('uid');
        $token = $request->headers->get('access-token');

        $user = $app['user.repository']->getByCredentials($uid, $token);

        if ($user === null) {
            return $app->json(['success' => false]);
        }

        return $app->json([
            'success' => true,
            'data' => $user
        ]);
    }

    public function getUser(Request $request, Application $app)
    {
        $uid = $request->get('uid');

        $user = $app['user.repository']->findById($uid);

        if (!$user) {
            return $app->json([
                'success' => false,
                'err' => 'User not found'
            ], 404);
        }

        return $app->json([
            'success' => true,
            'user' => $user
        ]);
    }

    public function getFriendsVotes(Request $request, Application $app)
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

        $size = $request->get('size') ? $request->get('size') : FRIENDS_VOTES_LIST_SIZE;
        $page = $request->get('page') ? $request->get('page') : 1;

        $totalSth = $app['pdo']->prepare('SELECT COUNT(votes.id) AS num FROM ( 
            SELECT *
            FROM user_friends us
            LEFT JOIN movie_vote mv ON mv.user_id = us.user_2
            WHERE user_1 = :uid
        ) votes');
        $totalSth->execute(['uid' => $user['id']]);
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
                'total' => $total,
                'page' => (int) $page,
                'pages' => ceil($total / $size),
                'entities' => $app['user.repository']->getFriendsVotes($user['id'], $size, ($page - 1) * $size)
            ]
        ]);
    }
}