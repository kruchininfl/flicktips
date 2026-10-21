<?php

namespace Controllers;

use Exception;
use Silex\Application;
use Symfony\Component\HttpFoundation\RedirectResponse;
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

        settype($user['id'], 'int');
        $viewer = $app['user.repository']->getByCredentials(
            $request->headers->get('uid'),
            $request->headers->get('access-token')
        );
        if ($viewer && $viewer['id'] !== $user['id']) {
            $user = array_merge($user, $app['user.repository']->getRelation($viewer['id'], $user['id']));
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
            LEFT JOIN movie_vote mv ON mv.user_id = us.user_2 AND us.subscribed=TRUE
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

//        $votes = $app['user.repository']->getFriendsVotes($user['id'], $size, ($page - 1) * $size);
        $votes = $app['user.repository']->getFriendsVotes($user['id'], $size * $page, 0);

        // update last seen notifications
        $sth = $app['pdo']->prepare('UPDATE user SET last_seen_notifications=NOW() WHERE id=:uid');
        $sth->execute(['uid' => $user['id']]);

        return $app->json([
            'success' => true,
            'results' => [
                'total' => $total,
                'page' => (int) $page,
                'pages' => ceil($total / $size),
                'entities' => $votes
            ]
        ]);
    }

    public function getBookmarks(Request $request, Application $app)
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

        $size = $request->get('size') ? $request->get('size') : BOOKMARKS_LIST_SIZE;
        $page = $request->get('page') ? $request->get('page') : 1;

        $totalSth = $app['pdo']->prepare('SELECT COUNT(bookmark.id) AS num FROM bookmark WHERE bookmark.user_id = :uid');
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
                'entities' => $app['user.repository']->getBookmarks($user['id'], $size, ($page - 1) * $size)
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

        $type = $request->get('type') === 'followers' ? 'followers' : 'following';
        $total = $app['user.repository']->countFriends($user['id'], $type);

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
                'entities' => $app['user.repository']->getFriends($user['id'], $size, ($page - 1) * $size, $type)
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
        $actionId = Array('super' => 3, 'like' => 2, 'neutral' => 1, 'dislike' => 0)[$action];

        $currentVote = $pdo->prepare('SELECT * FROM movie_vote WHERE movie_id=:entityId AND user_id=:userId');
        $currentVote->execute([
            'entityId' => $entityId,
            'userId' => $user['id']
        ]);
        $currentVote = $currentVote->fetch();

        $pdo->beginTransaction();
        $query = null;
        try {
            if ($currentVote && $actionId == $currentVote['vote']) {
                $pdo->prepare('DELETE FROM movie_vote WHERE movie_id=:entityId AND user_id=:userId')->execute([
                    'entityId' => $entityId,
                    'userId' => $user['id']
                ]);
            } else {
                $pdo->prepare('INSERT INTO movie_vote (`movie_id`, `user_id`, `vote`) VALUES (:entityId, :userId, :vote) ON DUPLICATE KEY UPDATE vote=:vote')->execute([
                    'entityId' => $entityId,
                    'userId' => $user['id'],
                    'vote' => $actionId
                ]);
            }

            $query = 'UPDATE movie';
            if ($currentVote) {
                $col = ['dislikes', 'neutral', 'likes', 'super'][$currentVote['vote']];
                $query .= ' SET ' . $col . '=' . $col . '-1';
            }
            if (!$currentVote || $actionId != $currentVote['vote']) {
                $col = ['dislikes', 'neutral', 'likes', 'super'][$actionId];
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

        // for the Telegram bot (tg-bot); a failure there must not fail the vote itself
        try {
            $removed = $currentVote && $actionId == $currentVote['vote'];
            $app['telegram.repository']->queueVote($user['id'], $entityId, $removed ? null : $actionId);
        } catch (\Exception $e) {
            error_log('telegram vote_event: ' . $e->getMessage());
        }

        $entitySth = $pdo->prepare('SELECT id, super, likes, dislikes, neutral FROM movie WHERE id=:entityId');
        $entitySth->execute([
            'entityId' => $entityId
        ]);
        $entityData = $entitySth->fetch();

        $response = [
            'success' => true,
            'data' => [
                'id' => intval($entityData['id']),
                'super' => intval($entityData['super']),
                'likes' => intval($entityData['likes']),
                'neutral' => intval($entityData['neutral']),
                'dislikes' => intval($entityData['dislikes']),
                'isSuper' => (!$currentVote || $currentVote['vote'] != $actionId) && $actionId === 3,
                'isLiked' => (!$currentVote || $currentVote['vote'] != $actionId) && $actionId === 2,
                'isNeutral' => (!$currentVote || $currentVote['vote'] != $actionId) && $actionId === 1,
                'isDisliked' => (!$currentVote || $currentVote['vote'] != $actionId) && $actionId === 0,
            ]
        ];

//        $app['socket']->send('vote-changed', [
//            'success' => true,
//            'data' => [
//                'id' => intval($entityData['id']),
//                'super' => intval($entityData['super']),
//                'likes' => intval($entityData['likes']),
//                'neutral' => intval($entityData['neutral']),
//                'dislikes' => intval($entityData['dislikes'])
//            ]
//        ]);

        return  $app->json($response);
    }

    public function toggleBookmark(Request $request, Application $app)
    {
        $uid = $request->headers->get('uid');
        $token = $request->headers->get('access-token');

        $user = $app['user.repository']->getByCredentials($uid, $token);
        $movieId = $request->get('movieId');

        if (!$user) {
            return $app->json([
                'success' => false,
                'msg' => 'authorization required'
            ], 401);
        }

        $sth = $app['pdo']->prepare('SELECT * FROM bookmark WHERE movie_id=:mid AND user_id=:uid');
        $sth->execute([
            'uid' => $user['id'],
            'mid' => $movieId
        ]);
        $count = $sth->rowCount();

        if ($count) {
            $sth = $app['pdo']->prepare('DELETE FROM bookmark WHERE movie_id=:mid AND user_id=:uid');
        } else {
            $sth = $app['pdo']->prepare('INSERT INTO bookmark (`user_id`, `movie_id`) VALUES (:uid, :mid)');
        }

        $sth->execute([
            'uid' => $user['id'],
            'mid' => $movieId
        ]);

        return $app->json([
            'success' => true,
            'data' => [
                'movie_id' => (int) $movieId,
                'inBookmarks' => !$count
            ]
        ]);
    }

    public function updateUser(Request $request, Application $app)
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

        $allowed = ['hide_viewed'];

        $params = $request->get('data');
        $setStr = '';
        $setParams = [];

        foreach ($allowed as $afield) {
            $param = $params[$afield];

            if (!is_null($param)) {
                $setStr .= ($setStr !== '' ? ', ' . $afield : $afield) . '=:' . $afield;
                $setParams[$afield] = $param;
            }
        }

        if ($setStr !== '') {
            $sth = $app['pdo']->prepare('UPDATE user SET ' . $setStr . ' WHERE id=:uid');
            $sth->execute(array_merge(
                [
                    'uid' => $user['id']
                ],
                $setParams
            ));

            $user = $app['user.repository']->getByCredentials($uid, $token);
        }

        return $app->json([
            'success' => true,
            'data' => $user
        ]);
    }

    public function subscribe(Request $request, Application $app)
    {
        $user = $app['user.repository']->getByCredentials(
            $request->headers->get('uid'),
            $request->headers->get('access-token')
        );

        if (!$user) {
            return $app->json([
                'success' => false,
                'msg' => 'authorization required'
            ], 401);
        }

        $userId = (int) $request->get('userId');
        $subscribed = (bool) $request->get('subscribed');

        if ($userId === $user['id']) {
            return $app->json([
                'success' => false,
                'msg' => 'cannot subscribe to yourself'
            ], 400);
        }

        if (!$app['user.repository']->findById($userId)) {
            return $app->json([
                'success' => false,
                'msg' => 'user not found'
            ], 404);
        }

        $app['user.repository']->setSubscribed($user['id'], $userId, $subscribed);

        return $app->json([
            'success' => true,
            'userId' => $userId,
            'subscribed' => $subscribed
        ]);
    }

    public function searchUsers(Request $request, Application $app)
    {
        $query = trim((string) $request->get('q'));
        $viewer = $app['user.repository']->getByCredentials(
            $request->headers->get('uid'),
            $request->headers->get('access-token')
        );

        if (mb_strlen($query) < 2) {
            return $app->json([
                'success' => true,
                'results' => []
            ]);
        }

        return $app->json([
            'success' => true,
            'results' => $app['user.repository']->search(mb_substr($query, 0, 64), $viewer ? $viewer['id'] : 0, USERS_SEARCH_SIZE)
        ]);
    }

    public function getRecommendations(Request $request, Application $app)
    {
        $user = $app['user.repository']->getByCredentials(
            $request->headers->get('uid'),
            $request->headers->get('access-token')
        );

        if (!$user) {
            return $app->json([
                'success' => false,
                'msg' => 'authorization required'
            ], 401);
        }

        return $app->json([
            'success' => true,
            'results' => $app['user.repository']->getRecommendations($user['id'], USERS_RECOMMENDATIONS_SIZE)
        ]);
    }

    public function getInviteCode(Request $request, Application $app)
    {
        $user = $app['user.repository']->getByCredentials(
            $request->headers->get('uid'),
            $request->headers->get('access-token')
        );

        if (!$user) {
            return $app->json([
                'success' => false,
                'msg' => 'authorization required'
            ], 401);
        }

        return $app->json([
            'success' => true,
            'code' => $app['user.repository']->getInviteCode($user['id'])
        ]);
    }

    public function getInvite(Request $request, Application $app)
    {
        $inviter = $app['user.repository']->findByInviteCode($request->get('code'));

        if (!$inviter) {
            return $app->json([
                'success' => false,
                'err' => 'Invite not found'
            ], 404);
        }

        return $app->json([
            'success' => true,
            'user' => $inviter
        ]);
    }

    public function acceptInvite(Request $request, Application $app)
    {
        $user = $app['user.repository']->getByCredentials(
            $request->headers->get('uid'),
            $request->headers->get('access-token')
        );

        if (!$user) {
            return $app->json([
                'success' => false,
                'msg' => 'authorization required'
            ], 401);
        }

        $inviter = $app['user.repository']->findByInviteCode($request->get('code'));

        if (!$inviter) {
            return $app->json([
                'success' => false,
                'err' => 'Invite not found'
            ], 404);
        }

        if ($inviter['id'] !== $user['id']) {
            $app['user.repository']->makeFriends($user['id'], $inviter['id']);
        }

        return $app->json([
            'success' => true,
            'inviterId' => $inviter['id']
        ]);
    }
}
