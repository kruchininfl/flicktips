<?php
$app->options('{anything}', function () {
    return new \Symfony\Component\HttpFoundation\JsonResponse(null, 200);
})->assert('anything', '.*');

$app->get('/api/', '\Controllers\IndexController::index');
$app->get('/api/search/{query}', '\Controllers\IndexController::search')->value('query', false);
$app->get('/api/get_trends/', '\Controllers\IndexController::getTrends');
$app->get('/api/get_film/{mid}', '\Controllers\IndexController::getFilm');
$app->get('/api/get_film_votes/{mid}', '\Controllers\IndexController::getFilmVotes');
$app->get('/api/update_poster/{mid}', '\Controllers\IndexController::updateAndGetPoster');
$app->get('/api/get_person/{pid}', '\Controllers\IndexController::getPerson');
$app->get('/api/get_last_graded_films/', '\Controllers\IndexController::getLastGradedFilms');
$app->get('/api/get_last_graded_films_friends/', '\Controllers\IndexController::getLastGradedFilmsFriends');
$app->get('/api/get_digital/', '\Controllers\IndexController::getDigitalFilms');

$app->get('/api/votes/user/{uid}', '\Controllers\IndexController::getVotes')->value('uid', false);

$app->get('/api/checkUser/', '\Controllers\UserController::validateToken');
$app->get('/api/user/{uid}', '\Controllers\UserController::getUser')->value('uid', false);
$app->get('/api/user/friends_votes/', '\Controllers\UserController::getFriendsVotes');
$app->get('/api/user/friends/', '\Controllers\UserController::getFriends');
$app->get('/api/user/bookmarks/', '\Controllers\UserController::getBookmarks');
$app->post('/api/user/vote/', '\Controllers\UserController::toggleVote');
$app->post('/api/user/toggle_subscribe/', '\Controllers\UserController::toggleSubscribe');
$app->post('/api/user/subscribe/', '\Controllers\UserController::subscribe');
$app->get('/api/user/invite/', '\Controllers\UserController::getInviteCode');
$app->get('/api/user/recommendations/', '\Controllers\UserController::getRecommendations');
$app->post('/api/user/accept_invite/', '\Controllers\UserController::acceptInvite');
$app->get('/api/users/search/', '\Controllers\UserController::searchUsers');
$app->get('/api/invite/{code}', '\Controllers\UserController::getInvite');
$app->post('/api/user/toggle_bookmark/', '\Controllers\UserController::toggleBookmark');
$app->put('/api/user/', '\Controllers\UserController::updateUser');
$app->get('/api/user/accounts/', '\Controllers\UserController::getAccounts');
$app->post('/api/user/accounts/link/', '\Controllers\UserController::linkAccount');
$app->post('/api/user/accounts/merge/', '\Controllers\UserController::mergeAccount');
$app->post('/api/user/accounts/unlink/', '\Controllers\UserController::unlinkAccount');

$app->get('/api/updateGenres/', '\Controllers\IndexController::updateGenres');

$app->get('/api/get_datasets/', '\Controllers\IndexController::getDatasets');