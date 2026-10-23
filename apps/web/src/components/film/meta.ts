import type { MovieBase } from '@flicktips/shared';

import { yearOf } from '@/lib/dates';
import { genreNames } from '@/lib/movies';

// «2024 · сериал, драма»: the year, then the genres (a series says so first).
export function movieMeta(movie: Pick<MovieBase, 'release_date' | 'first_air_date' | 'genres' | 'type'>, genres = 2) {
  const year = yearOf(movie.release_date || movie.first_air_date);
  const names = genreNames(movie.genres).slice(0, genres);
  if (movie.type === 'tv') names.unshift('сериал');
  return [year, names.join(', ')].filter(Boolean).join(' · ');
}
