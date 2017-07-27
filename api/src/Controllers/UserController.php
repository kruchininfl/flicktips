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

    public function getFriends(Request $request, Application $app)
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

        $size = $request->get('size') ? $request->get('size') : FRIENDS_LIST_SIZE;
        $page = $request->get('page') ? $request->get('page') : 1;

        $totalSth = $app['pdo']->prepare('SELECT COUNT(user_friends.user_2) AS num FROM user_friends WHERE user_friends.user_1 = :uid');
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
                'entities' => $app['user.repository']->getFriends($user['id'], $size, ($page - 1) * $size)
            ]
        ]);
    }

    public function toggleSubscribe(Request $request, Application $app)
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

        $friendId = $request->get('friendId');

        $sth = $app['pdo']->prepare('UPDATE user_friends SET subscribed=IF(subscribed = 1, 0, 1) WHERE user_1=:uid AND user_2=:fid;');
        $sth->execute([
            'uid' => $user['id'],
            'fid' => $friendId
        ]);
        $count = $sth->rowCount();

        if (!$count) {
            return $app->json([
                'success' => false,
                'msg' => 'friend not found'
            ]);
        }

        $sth = $app['pdo']->prepare('SELECT user_friends.subscribed, user_friends.user_2 as friendId FROM user_friends WHERE user_1=:uid AND user_2=:fid;');
        $sth->execute([
            'uid' => $user['id'],
            'fid' => $friendId
        ]);
        $resp = $sth->fetch();

        return $app->json([
            'success' => true,
            'friendId' => $resp['friendId'],
            'subscribed' => $resp['subscribed']
        ]);
    }
}