<?php

namespace Services;

use Silex\Application;

class TMDBServiceProvider
{
    const API_URL = 'https://api.themoviedb.org/3';
    const API_KEY = 'd272326e467344029e68e3c4ff0b4059';
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
            'api_key' => self::API_KEY,
            'language' => self::API_LANG,
            'include_adult' => self::API_INCLUDE_ADULT
        ], $params));

        $url = self::API_URL . $method . '?' . $query;
        return json_decode($this->app['guzzle']->request('GET', $url, ['proxy' => 'http://u5dkhH:N3Bjb0@196.19.122.135:8000'])->getBody());
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
