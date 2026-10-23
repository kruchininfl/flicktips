// Response shapes of the endpoints FlickTips uses. Only the fields we read are typed;
// see https://kinopoiskapiunofficial.tech/documentation/api/ for the rest.

export type KpFilmType = 'FILM' | 'VIDEO' | 'TV_SERIES' | 'MINI_SERIES' | 'TV_SHOW';

export interface KpFilm {
  kinopoiskId: number;
  imdbId: string | null;
  nameRu: string | null;
  nameEn: string | null;
  nameOriginal: string | null;
  posterUrl: string | null;
  posterUrlPreview: string | null;
  ratingKinopoisk: number | null;
  ratingKinopoiskVoteCount: number | null;
  ratingImdb: number | null;
  ratingImdbVoteCount: number | null;
  year: number | null;
  filmLength: number | null;
  description: string | null;
  shortDescription: string | null;
  type: KpFilmType;
  startYear: number | null;
  endYear: number | null;
  countries: { country: string }[];
  genres: { genre: string }[];
}

// Item of GET /api/v2.2/films (search with filters)
export interface KpFilmListItem {
  kinopoiskId: number;
  imdbId: string | null;
  nameRu: string | null;
  nameEn: string | null;
  nameOriginal: string | null;
  countries: { country: string }[];
  genres: { genre: string }[];
  ratingKinopoisk: number | null;
  ratingImdb: number | null;
  year: number | null;
  type: KpFilmType;
  posterUrl: string | null;
  posterUrlPreview: string | null;
}

export interface KpFilmList {
  total: number;
  totalPages: number;
  items: KpFilmListItem[];
}

export interface KpVideo {
  url: string;
  name: string;
  site: 'YOUTUBE' | 'KINOPOISK_WIDGET' | 'YANDEX_DISK' | 'UNKNOWN' | string;
}

export interface KpVideos {
  total: number;
  items: KpVideo[];
}

export interface KpStaff {
  staffId: number;
  nameRu: string | null;
  nameEn: string | null;
  description: string | null;
  posterUrl: string | null;
  professionText: string;
  professionKey: string;
}

export interface KpFilters {
  genres: { id: number; genre: string }[];
  countries: { id: number; country: string }[];
}
