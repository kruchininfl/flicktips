<?php
$app->options('{anything}', function () {
    return new \Symfony\Component\HttpFoundation\JsonResponse(null, 200);
})->assert('anything', '.*');

$app->get('/api/', '\Controllers\IndexController::index');
$app->get('/api/search/{query}', '\Controllers\IndexController::search')->value('query', false);

$app->post('/api/vote/', '\Controllers\IndexController::toggleVote');
$app->get('/api/votes/user/{uid}', '\Controllers\IndexController::getVotes')->value('uid', false);

$app->get('/api/checkUser/', '\Controllers\UserController::validateToken');
$app->get('/api/user/{uid}', '\Controllers\UserController::getUser')->value('uid', false);
$app->get('/api/user/friends_votes/', '\Controllers\UserController::getFriendsVotes');
$app->get('/api/user/friends/', '\Controllers\UserController::getFriends');
$app->post('/api/user/toggleSubscribe/', '\Controllers\UserController::toggleSubscribe');

$app->get('/api/updateGenres/', '\Controllers\IndexController::updateGenres');