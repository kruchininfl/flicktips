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

define('VKONTAKTE_API_KEY',    env_var('VKONTAKTE_API_KEY'));
define('VKONTAKTE_API_SECRET', env_var('VKONTAKTE_API_SECRET'));
define('YANDEX_CLIENT_ID',     env_var('YANDEX_CLIENT_ID'));
define('YANDEX_CLIENT_SECRET', env_var('YANDEX_CLIENT_SECRET'));

define('VOTES_LIST_SIZE', 24);
define('FRIENDS_VOTES_LIST_SIZE', 24);
define('FRIENDS_LIST_SIZE', 24);
define('USERS_SEARCH_SIZE', 20);
define('USERS_RECOMMENDATIONS_SIZE', 12);
define('BOOKMARKS_LIST_SIZE', 24);
define('TRENDS_LIST_SIZE', 24);
define('HOME_LIST_SIZE', 24);
define('DIGITAL_LIST_SIZE', 24);
define('FILMS_VOTES_SIZE', 50);


define('TMDB_API_KEY', env_var('TMDB_API_KEY'));
define('TMDB_PROXY', env_var('TMDB_PROXY', ''));