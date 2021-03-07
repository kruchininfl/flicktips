import {q} from '../core/db';
import {RowDataPacket} from 'mysql2';

export interface IMyMovie {
  tmdb_id: number;
  type: "movie" | "tv";
  title?: string;
  original_title?: string;
  tmdb_poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  tmdb_overview?: string;
  original_language?: string;
  tmdb_trailers?: string | null;
  tmdb_popularity?: number;
  kp_id: number;
  kp_title?: string;
  kp_original_title?: string;
  kp_start_year?: number | null;
  kp_finish_year?: number | null;
  kp_overview?: string | null;
  kp_duration?: number | null;
  kp_release_date_dvd?: string | null;
  kp_release_date_rus?: string | null;
  kp_rating_value?: number | null;
  kp_rating_count?: number | null;
  imdb_id?: string | null;
  imdb_rating_value?: number | null;
  imdb_rating_count?: number | null;
  kp_force_check: number;
  kp_countries?: string[];
  genres?: number[];
  kp_genres?: string[];
}

export default async function insertMyMovie(movie: IMyMovie) {
  const {
    kp_genres,
    genres,
    kp_countries,
    ...spread
  } = movie;

  const mainData = {
    ...spread,
    tmdb_id: `${spread.type}_${spread.tmdb_id}`,
  }

  const [ existing ] = await q(`SELECT id FROM movie WHERE tmdb_id = ? OR kp_id = ? OR imdb_id = ?`, [
    mainData.tmdb_id,
    mainData.kp_id,
    mainData.imdb_id,
  ]) as RowDataPacket[][];

  if (existing.length > 1) {
    console.error("Parsing error!", mainData);
    return false;
  } else if (existing.length === 1) {
    const {
      tmdb_trailers,
      ...dataForUpdate
    } = mainData;

    await q(`UPDATE movie SET ? WHERE id = ?`, [dataForUpdate, existing[0].id]);
  } else {
    await q(`INSERT INTO movie SET ?`, mainData);
  }

  const [ updated ] = await q(`SELECT id FROM movie WHERE kp_id = ?`, [mainData.kp_id]) as RowDataPacket[][];
  const movieId = updated[0].id;

  if (movieId && kp_genres?.length) {
    await q("INSERT `kp-genre` (name) VALUES ? ON DUPLICATE KEY UPDATE name = VALUES(name)", [kp_genres.map((genre) => [genre])]);
    const [ rows ] = await q("SELECT id FROM `kp-genre` WHERE name IN (?)", [kp_genres.map((genre) => genre)]) as RowDataPacket[][];

    if (rows.length) {
      await q(`INSERT \`movie_kp-genre\` (movie_id, \`kp-genre_id\`) VALUES ? 
        ON DUPLICATE KEY UPDATE movie_id = VALUES(movie_id), \`kp-genre_id\` = VALUES(\`kp-genre_id\`)`, [rows.map(({ id: genre }) => [movieId, genre])]);
    }
  }

  if (movieId && genres?.length) {
    await q("INSERT genre (tmdb_id) VALUES ? ON DUPLICATE KEY UPDATE tmdb_id = VALUES(tmdb_id)", [genres.map((genre) => [genre])]);
    const [ rows ] = await q("SELECT id FROM genre WHERE tmdb_id IN (?)", [genres.map((genre) => genre)]) as RowDataPacket[][];

    if (rows.length) {
      await q(`INSERT movie_genre (movie_id, genre_id) VALUES ? 
        ON DUPLICATE KEY UPDATE movie_id = VALUES(movie_id), genre_id = VALUES(genre_id)`, [rows.map(({ id: genre }) => [movieId, genre])]);
    }
  }

  if (movieId && kp_countries?.length) {
    await q("INSERT country (name) VALUES ? ON DUPLICATE KEY UPDATE name = VALUES(name)", [kp_countries.map((country) => [country])]);
    const [ rows ] = await q("SELECT id FROM country WHERE name IN (?)", [kp_countries.map((country) => country)]) as RowDataPacket[][];

    if (rows.length) {
      await q(`INSERT movie_country (movie_id, country_id) VALUES ? 
        ON DUPLICATE KEY UPDATE movie_id = VALUES(movie_id), country_id = VALUES(country_id)`, [rows.map(({ id: country }) => [movieId, country])]);
    }
  }

  return movieId;
}