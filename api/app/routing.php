<?php
$app->options('{anything}', function () {
    return new \Symfony\Component\HttpFoundation\JsonResponse(null, 200);
})->assert('anything', '.*');

$app->get('/api/', '\Controllers\IndexController::index');
$app->get('/api/search/{query}', '\Controllers\IndexController::search')->value('query', false);
$app->get('/api/get_trends/', '\Controllers\IndexController::getTrends');
$app->get('/api/get_film/{mid}', '\Controllers\IndexController::getFilm');
$app->get('/api/get_film_votes/{mid}', '\Controllers\IndexController::getFilmVotes');
$app->get('/api/get_person/{pid}', '\Controllers\IndexController::getPerson');
$app->get('/api/get_last_graded_films/', '\Controllers\IndexController::getLastGradedFilms');
$app->get('/api/get_last_graded_films_friends/', '\Controllers\IndexController::getLastGradedFilmsFriends');

$app->get('/api/votes/user/{uid}', '\Controllers\IndexController::getVotes')->value('uid', false);

$app->get('/api/app/authVk/', '\Controllers\UserController::validateVkUser');

$app->get('/api/checkUser/', '\Controllers\UserController::validateToken');
$app->get('/api/user/{uid}', '\Controllers\UserController::getUser')->value('uid', false);
$app->get('/api/user/friends_votes/', '\Controllers\UserController::getFriendsVotes');
$app->get('/api/user/friends/', '\Controllers\UserController::getFriends');
$app->get('/api/user/bookmarks/', '\Controllers\UserController::getBookmarks');
$app->post('/api/user/vote/', '\Controllers\UserController::toggleVote');
$app->post('/api/user/toggle_subscribe/', '\Controllers\UserController::toggleSubscribe');
$app->post('/api/user/toggle_bookmark/', '\Controllers\UserController::toggleBookmark');
$app->put('/api/user/', '\Controllers\UserController::updateUser');

$app->get('/api/updateGenres/', '\Controllers\IndexController::updateGenres');