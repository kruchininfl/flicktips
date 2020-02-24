<?php

use Aws\Silex\AwsServiceProvider;
use Csanquer\Silex\PdoServiceProvider\Provider\PDOServiceProvider;
use Security\AuthenticationSuccessHandler;

$app->register(
    new PDOServiceProvider('pdo'),
    array(
        'pdo.server'   => array(
            'driver'   => 'mysql',
            'host'     => 'localhost',
            'dbname'   => $app['env'] == 'prod' ? 'flicktips' : 'flicktips_test',
            'port'     => 3306,
            'user'     => 'flicktips',
            'password' => 'Aing6si',
        ),
        'pdo.options' => array(
            \PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES 'UTF8'"
        ),
        'pdo.attributes' => array(
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC
        ),
    )
);

$app->register(new AwsServiceProvider(), array(
    'aws.config' => array(
        'version' => 'latest',
        'region' => 'eu-central-1',
        'credentials' => [
            'key'    => 'AKIAJY7LFQK7M62YAFYA',
            'secret' => '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'
        ]
    )
));
$app['user.repository'] = new Repositories\UserRepository($app);

$app['movie.repository'] = new Repositories\MovieRepository($app);

$app['person.repository'] = new Repositories\PersonRepository($app);

$app['guzzle'] = new \GuzzleHttp\Client();

$app['tmdb'] = new \Services\TMDBServiceProvider($app);

$app['mapper'] = new \Services\Mapper();

$app['socket'] = new \Services\Socket();

$app->register(new Silex\Provider\RoutingServiceProvider());

$app->register(new Services\OAuthServiceProvider(), array(
    'oauth.services' => array(
        'Facebook' => array(
            'key' => FACEBOOK_API_KEY,
            'secret' => FACEBOOK_API_SECRET,
            'scope' => array('email', 'public_profile', 'user_friends'),
            'user_endpoint' => 'https://graph.facebook.com/me/?fields=name,picture.type(large){url},gender,location,friends.limit(5000){id}'
        ),
        'Vkontakte' => array(
            'key' => VKONTAKTE_API_KEY,
            'secret' => VKONTAKTE_API_SECRET,
            'scope' => array('friends'),
            'user_endpoint' => function ($token) {
                if (isset($token) && $userId = $token->getAccessToken()->getExtraParams()['user_id']) {
                    return 'https://api.vk.com/method/users.get?v=5.0&fields=photo_max_orig,photo_400_orig,sex&user_ids=' . $userId;
                }
                return 'https://api.vk.com/method/users.get?v=5.0&fields=photo_max_orig,photo_400_orig,sex';
            }
        )
    )
));

$app->register(new Silex\Provider\SessionServiceProvider(), array(
    'session.storage.save_path' => '/tmp'
));

$app->register(new Silex\Provider\SecurityServiceProvider(), array(
    'security.firewalls' => array(
        'default' => array(
            'pattern' => '^/',
            'anonymous' => true,
            'oauth' => array(
                'login_path' => '/auth/{service}',
                'callback_path' => '/auth/{service}/callback?auth_origin_url={auth_origin_url}',
                'check_path' => '/auth/{service}/check?auth_origin_url={auth_origin_url}',
                'with_csrf' => true,
                'require_previous_session' => false
            ),
            'logout' => array(
                'logout_path' => '/logout',
                'with_csrf' => true
            ),
            // OAuthInMemoryUserProvider returns a StubUser and is intended only for testing.
            // Replace this with your own UserProvider and User class.
//            'users' => new Gigablah\Silex\OAuth\Security\User\Provider\OAuthInMemoryUserProvider()
            'users' => new Security\OAuthUserProvider($app)
        )
    ),
    'security.access_rules' => array(
        array('^/auth', 'ROLE_USER')
    ),
    'security.authentication.success_handler._proto' => $app->protect(function ($name, $options) use ($app) {
        return function () use ($name, $options, $app) {
            $handler = new AuthenticationSuccessHandler(
                $app['security.http_utils'],
                $options
            );
            $handler->setProviderKey($name);

            return $handler;
        };
    })
));