import FetchBase from './FetchBase';
import {AxiosRequestConfig} from 'axios';

const {_} = new FetchBase({
  baseUrl: "http://api.themoviedb.org/3",
  timeout: 5000,
  enableProxy: true,
  headers: {
    "Content-Type": "application/json",
  },
  maxTry: 5,
});

async function fetchTmdb<T>(url: string, params?: AxiosRequestConfig["params"]) {
   return _<T>(url, {
    params: {
      ...(params || {}),
      api_key: "d272326e467344029e68e3c4ff0b4059",
      language: "ru-RU",
    }
  });
}

interface ISearchResultMovie {
  poster_path: string | null;
  adult: boolean;
  overview: string;
  release_date: string;
  genre_ids: number[];
  id: number;
  original_title: string;
  original_language: string;
  title: string;
  backdrop_path: string | null;
  popularity: number;
  vote_count: number;
  video: boolean;
  vote_average: number;
}

interface ISearchResultTv {
  poster_path: string | null;
  popularity: number;
  id: number;
  backdrop_path: string | null;
  vote_average: number;
  overview: string;
  first_air_date: string;
  origin_country: string[];
  genre_ids: number[];
  original_language: string;
  vote_count: number;
  name: string;
  original_name: string;
}

interface ISearchResult {
  movie_results: undefined[] | ISearchResultMovie[];
  tv_results: ISearchResultTv[];
}

export async function fetchTmdbExternalFilm(id: string) {
  return fetchTmdb<ISearchResult>(`/find/${id}`, {
    external_source: "imdb_id",
  });
}