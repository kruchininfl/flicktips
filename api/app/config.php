<?php

// Secrets come from the environment (docker compose env_file: .env on the server;
// see .env.example). php-fpm passes them through because of clear_env = no.
function env_var($name, $default = null)
{
    $value = getenv($name);
    if ($value === false || $value === '') {
        if (func_num_args() > 1) {
            return $default;
        }
        throw new RuntimeException("Missing environment variable $name");
    }
    return $value;
}

define('FACEBOOK_API_KEY',    env_var('FACEBOOK_API_KEY'));
define('FACEBOOK_API_SECRET', env_var('FACEBOOK_API_SECRET'));
define('VKONTAKTE_API_KEY',    env_var('VKONTAKTE_API_KEY'));
define('VKONTAKTE_API_SECRET', env_var('VKONTAKTE_API_SECRET'));
define('VKONTAKTE_APP_API_KEY',    env_var('VKONTAKTE_APP_API_KEY'));
define('VKONTAKTE_APP_API_SECRET', env_var('VKONTAKTE_APP_API_SECRET'));
define('VKONTAKTE_APP_SERVICE_KEY', env_var('VKONTAKTE_APP_SERVICE_KEY'));

define('VOTES_LIST_SIZE', 24);
define('FRIENDS_VOTES_LIST_SIZE', 24);
define('FRIENDS_LIST_SIZE', 24);
define('BOOKMARKS_LIST_SIZE', 24);
define('TRENDS_LIST_SIZE', 24);
define('HOME_LIST_SIZE', 24);
define('DIGITAL_LIST_SIZE', 24);
define('FILMS_VOTES_SIZE', 50);

define('ENABLE_S3', false);

define('TMDB_API_KEY', env_var('TMDB_API_KEY'));
define('TMDB_PROXY', env_var('TMDB_PROXY', ''));