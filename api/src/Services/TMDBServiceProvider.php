<?php

namespace Services;

use Silex\Application;

class TMDBServiceProvider
{
    const API_URL = 'https://api.themoviedb.org/3';
    const API_LANG = 'ru-RU';
    const API_INCLUDE_ADULT = false;

    protected $app;

    public function __construct(Application $app)
    {
        $this->app = $app;
    }

    private function _call($method, $params = array())
    {
        $query = http_build_query(array_merge([
            'api_key' => TMDB_API_KEY,
            'language' => self::API_LANG,
            'include_adult' => self::API_INCLUDE_ADULT
        ], $params));

        $url = self::API_URL . $method . '?' . $query;

        $options = array();
        if (defined('TMDB_PROXY') && TMDB_PROXY !== '') {
            $options['proxy'] = TMDB_PROXY;
        }

        return json_decode($this->app['guzzle']->request('GET', $url, $options)->getBody());
    }

    public function multiSearch($query)
    {
        return $this->_call('/search/multi', ['query' => $query]);
    }

    public function getMovieGenres()
    {
        return $this->_call('/genre/movie/list');
    }

    public function getTvGenres()
    {
        return $this->_call('/genre/tv/list');
    }

    public function getMovie($id)
    {
        return $this->_call('/' . str_replace('_', '/', $id), ['append_to_response' => 'videos']);
    }
}
