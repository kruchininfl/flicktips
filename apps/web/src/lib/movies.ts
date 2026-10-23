// Movie helpers shared by the cards and the pages (web/src/helpers.js).
import type { MovieBase, VoteName } from '@flicktips/shared';

import { SITE_URL, TMDB_POSTER_342 } from './config';

// Vote ids as the API stores them: 0 - dislike, 1 - neutral, 2 - like, 3 - super
export const VOTE_NAMES: readonly VoteName[] = ['dislike', 'neutral', 'like', 'super'];
export const VOTE_TEXTS = ['Очень плохо', 'Средне', 'Хорошо', 'Супер'] as const;

type PosterSource = Pick<MovieBase, 'kp_id' | 'tmdb_poster_path'>;

// Posters come from Кинопоиск through our nginx (/poster/kp/<kp_id>.jpg, cached there): image.tmdb.org is often
// unreachable from Russia. The TMDb path goes along so nginx can redirect to it when Кинопоиск has no poster.
// `absolute` for metadata (og:image); pages use the relative URL.
export function getPosterUrl(movie: PosterSource, absolute = false): string | null {
  if (movie.kp_id && Number(movie.kp_id) > 0) {
    const query = movie.tmdb_poster_path ? '?tmdb=' + movie.tmdb_poster_path : '';
    return (absolute ? SITE_URL : '') + '/poster/kp/' + movie.kp_id + '.jpg' + query;
  }
  return movie.tmdb_poster_path ? TMDB_POSTER_342 + movie.tmdb_poster_path : null;
}

// When the movie was last voted on: the profile's own vote (`timestamp`) or the latest of the listed votes.
export function getLastVoteTime(movie: Pick<MovieBase, 'votes'> & { timestamp?: number | string }): number {
  const own = Number(movie.timestamp) || 0;
  if (own) return own;
  const times = (movie.votes ?? []).map((v) => v.timestamp || 0);
  return times.length ? Math.max(...times) : 0;
}

// Genre names whether the API sent {id, name} objects or plain strings.
export function genreNames(genres: MovieBase['genres'] | string[] | undefined): string[] {
  return (genres ?? [])
    .map((g: { name: string } | string) => (typeof g === 'string' ? g : g?.name))
    .filter((name): name is string => !!name);
}

export function pluralGender(
  gender: string | null | undefined,
  phrases: [male: string, female: string, other: string],
) {
  if (gender === 'male') return phrases[0];
  if (gender === 'female') return phrases[1];
  return phrases[2];
}
