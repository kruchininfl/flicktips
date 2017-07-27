<?php
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

require_once __DIR__.'/vendor/autoload.php';
require_once __DIR__.'/kp/src/wielski/KinopoiskApi/Kinopoisk.php';
require_once '../rediska/library/Rediska.php';

$app = new Silex\Application();
$kp = new \wielski\KinopoiskApi\Kinopoisk();

$app->after(function (Request $request, Response $response) {
    $response->headers->set('Content-Type', 'application/json');
});

// Please set to false in a production environment
$app['debug'] = true;

$app->get('/kp/search/{query}', function($query) use ($kp) {
    return new Response($kp->call('searchFilms', [
        'keyword' => $query
    ]));
});

$app->get('/kp/getFilm/{id}', function($id) use ($kp) {
//    $kp->enableSetProxyFromRedis = false;
//    $kp->enableTorProxy = true;
    return new Response($kp->call('getFilm', ['filmID' => $id]));
});

$app->run();