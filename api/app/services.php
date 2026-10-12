<?php

use Csanquer\Silex\PdoServiceProvider\Provider\PDOServiceProvider;
use Security\AuthenticationSuccessHandler;

$app->register(
    new PDOServiceProvider('pdo'),
    array(
        'pdo.server'   => array(
            'driver'   => 'mysql',
            'host'     => env_var('DB_HOST', '127.0.0.1'),
            'dbname'   => $app['env'] == 'prod' ? 'flicktips' : 'flicktips_test',
            'port'     => (int) env_var('DB_PORT', 3306),
            'user'     => env_var('DB_USER', 'flicktips'),
            'password' => env_var('DB_PASSWORD'),
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
        'Vkontakte' => array(
            'class' => '\Services\VkId',
            'key' => VKONTAKTE_API_KEY,
            'secret' => VKONTAKTE_API_SECRET,
            // VK ID profile: name, sex, avatar
            'user_endpoint' => 'https://id.vk.ru/oauth2/user_info'
        ),
        'Yandex' => array(
            'class' => '\Services\Yandex',
            'key' => YANDEX_CLIENT_ID,
            'secret' => YANDEX_CLIENT_SECRET,
            // name, sex, avatar; the scopes are set on the app in oauth.yandex.ru
            'user_endpoint' => 'https://login.yandex.ru/info?format=json'
        )
    )
));

$app->register(new Silex\Provider\SessionServiceProvider(), array(
    'session.storage.save_path' => '/tmp',
    'session.storage.options' => array(
        'cookie_lifetime' => 31536000
    )
));

$app->register(new Silex\Provider\SecurityServiceProvider(), array(
    'security.firewalls' => array(
        'default' => array(
            'pattern' => '^/',
            'anonymous' => true,
            'oauth' => array(
                'login_path' => '/auth/{service}',
                'callback_path' => '/auth/{service}/callback',
                'check_path' => '/auth/{service}/check',
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
