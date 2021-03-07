import selectFilmUnmatch from '../db/selectFilmUnmatch';
import fetchFlickTips from '../core/fetchFlickTips';
import updateFilmMatchDate from '../db/updateFilmMatchDate';
import {fetchKpUnOfficialFilm} from '../core/fetchKpUnOfficial';
import {fetchTmdbExternalFilm} from '../core/fetchTmdb';
import insertMyMovie from '../db/insertMyMovie';
import {IProgress} from '../app';

interface IRequestResponse {
  total: number;
  results: any[];
}

const getSearchWord = (str: string) => (
  encodeURI(str.replace(/ё/g, "е"))
)

const getMovieByKpId = async (kpId: number) => {
  const kpResp = await fetchKpUnOfficialFilm(kpId);
  const kpData = !kpResp.error ? {
    ...kpResp.payload.data,
    rating: kpResp.payload.rating,
    externalId: kpResp.payload.externalId,
  } : undefined;
  const type = kpData?.type;
  const imdbId = kpData?.externalId?.imdbId;

  console.log("imdbId", imdbId);

  if (!imdbId || !type || !["FILM", "TV_SHOW"].includes(type)) {
    return undefined;
  }

  const tmdbResp = await fetchTmdbExternalFilm(imdbId);
  const tmdbDataMovie = !tmdbResp.error ? tmdbResp.payload.movie_results[0] : undefined;
  const tmdbDataTv = !tmdbResp.error ? tmdbResp.payload.tv_results[0] : undefined;

  if (
    (type === "FILM" && !tmdbDataMovie) ||
    (type === "TV_SHOW" && !tmdbDataTv)
  ) {
    return undefined;
  }

  const kpYears = kpData?.year.split("-");

  return {
    tmdb_id: (tmdbDataMovie?.id || tmdbDataTv?.id) as number,
    type: {
      "FILM": "movie",
      "TV_SHOW": "tv",
    }[type],
    title: tmdbDataMovie?.title || tmdbDataTv?.name,
    original_title: tmdbDataMovie?.original_title || tmdbDataTv?.original_name,
    tmdb_poster_path: tmdbDataMovie?.poster_path || tmdbDataTv?.poster_path,
    release_date: tmdbDataMovie?.release_date,
    first_air_date: tmdbDataTv?.first_air_date,
    tmdb_overview: tmdbDataMovie?.overview || tmdbDataTv?.overview,
    original_language: tmdbDataMovie?.original_language || tmdbDataTv?.original_language,
    tmdb_trailers: null,
    tmdb_popularity: tmdbDataMovie?.popularity || tmdbDataTv?.popularity,
    kp_id: kpId,
    kp_title: kpData?.nameRu,
    kp_original_title: kpData?.nameEn,
    kp_start_year: type === "TV_SHOW" && kpYears?.[0] && !Number.isNaN(Number(kpYears[0])) ? Number(kpYears[0]) : undefined,
    kp_finish_year: type === "TV_SHOW" && kpYears?.[1] && !Number.isNaN(Number(kpYears[1])) ? Number(kpYears[1]) : undefined,
    kp_overview: kpData?.description,
    kp_duration: (() => {
      if (!kpData?.filmLength) {
        return undefined;
      }

      const arr = kpData.filmLength.split(":");

      if (arr[1]) {
        return Number(arr[0]) * 60 + Number(arr[1]);
      } else {
        return Number(arr[0]);
      }
    })(),
    kp_release_date: kpData?.premiereWorld,
    kp_release_date_dvd: kpData?.premiereDvd,
    kp_release_date_rus: kpData?.premiereRu,
    kp_rating_value: kpData?.rating.rating,
    kp_rating_count: kpData?.rating.ratingVoteCount,
    imdb_id: imdbId,
    imdb_rating_value: kpData?.rating.ratingImdb,
    imdb_rating_count: kpData?.rating.ratingVoteCount,
    kp_force_check: 0,
    genres: tmdbDataMovie?.genre_ids || tmdbDataTv?.genre_ids,
    kp_countries: kpData?.countries.map(({ country }) => country),
    kp_genres: kpData?.genres.map(({ genre }) => genre),
  }
}

export default async function matchFastTorrentFilms(progress: IProgress) {
  const {
    total,
    rows: films,
  } = await selectFilmUnmatch(10);

  if (!total || !films.length) {
    return;
  }

  progress.currentStep = "match";
  progress.steps.match.total = total;

  for (const film of films) {
    if (!film.my_kp_id) {
      const filmById = await getMovieByKpId(film.kp_id);

      if (filmById) {
        const resp = await insertMyMovie(filmById);

        if (resp) {
          progress.steps.match.matchById++;
        }
      } else {
        const filmByName = film.name ? await fetchFlickTips<IRequestResponse>(`/search/${getSearchWord(film.name)}`) : undefined;

        if (filmByName && !filmByName.error && filmByName.payload.results.some((r) => (
          r.kp_id === film.kp_id
        ))) {
          progress.steps.match.matchByName++;
        } else if (film.original_name) {
          const filmByOriginal = await fetchFlickTips<IRequestResponse>(`/search/${getSearchWord(film.original_name)}`);

          if (filmByOriginal && !filmByOriginal.error && filmByOriginal.payload.results.some((r) => (
            r.kp_id === film.kp_id
          ))) {
            progress.steps.match.matchByName++;
          }
        }
      }
    } else {
      progress.steps.match.skipped++;
    }

    progress.steps.match.totalComplete++;
  }

  await updateFilmMatchDate(films.map(({ id }) => id));

  return await matchFastTorrentFilms(progress);
}