import FetchBase from './FetchBase';
import {env} from './env';

const {_} = new FetchBase({
  baseUrl: "https://kinopoiskapiunofficial.tech/api/v2.1/",
  timeout: 5000,
  enableProxy: false,
  headers: {
    "X-API-KEY": env("KP_API_KEY"),
  },
});

interface IFilm {
  data: {
    nameRu: string;
    nameEn: string;
    year: string;
    description: string;
    type: "FILM" | "TV_SHOW" | "UNKNOWN";
    filmLength: string;
    premiereWorld: string;
    premiereDvd: string;
    premiereRu: string;
    countries: Array<{country: string}>;
    genres: Array<{genre: string}>;
  };
  rating: {
    rating: number;
    ratingVoteCount: number;
    ratingImdb: number;
    ratingImdbVoteCount: number;
  };
  externalId: {
    imdbId: string | null;
  };
}

export async function fetchKpUnOfficialFilm(id: number) {
  return _<IFilm>(`films/${id}?append_to_response=RATING`);
}