<?php
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

require_once __DIR__ . '/../vendor/autoload.php';

require __DIR__ . '/config.php';

$app = new Silex\Application();

$app->after(function (Request $request, Response $response) {
    $response->headers->set('Access-Control-Expose-Headers', 'access-token, expiry, token-type, uid, client');
    $response->headers->set('Access-Control-Allow-Headers', 'access-token,authorization,client,expiry,if-modified-since,token-type,uid,content-type');
    $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    $response->headers->set('Access-Control-Allow-Origin', '*');
    $response->headers->set('Access-Control-Allow-Credentials', true);
});

$app->before(function (Request $request) {
    if (0 === strpos($request->headers->get('Content-Type'), 'application/json')) {
        $data = json_decode($request->getContent(), true);
        $request->request->replace(is_array($data) ? $data : array());
    }
});

$app['env'] = $_SERVER['HTTP_HOST'] == 'dev.flicktips.ru:8888' ? 'dev' : 'prod';
// debug pages print stack traces with OAuth tokens and SQL, so only outside prod
$app['debug'] = $app['env'] !== 'prod';
ini_set('display_errors', $app['debug'] ? 1 : 0);

//register an error handler
Symfony\Component\Debug\ErrorHandler::register();

// with debug off nothing else records failures; this goes to the container log via php-fpm
// untyped on purpose: Silex skips handlers whose type hint does not match, e.g. \Error
$app->error(function ($e, $code) {
    if ($code >= 500) {
        error_log(sprintf('%s: %s at %s:%d', get_class($e), $e->getMessage(), $e->getFile(), $e->getLine()));
    }
});
//$app->error(function (\Exception $e, $code) use ($app) {
//
//    $error = array(
//        'code' => $e->getCode(),
//        'message' => $e->getMessage()
//    );
//
//    return $app->json($error, 200);
//});

//$app->register(new Silex\Provider\MonologServiceProvider(), array(
//    'monolog.logfile' => __DIR__.'/log/prod.log',
//));

require __DIR__ . '/services.php';

require __DIR__ . '/routing.php';

$app->run();