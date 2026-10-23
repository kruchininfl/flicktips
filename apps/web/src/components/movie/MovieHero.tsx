import Link from 'next/link';

import type { MovieBase } from '@flicktips/shared';

import { formatVoteTime, yearOf } from '@/lib/dates';
import { genreNames, getLastVoteTime, getPosterUrl } from '@/lib/movies';

import { MovieBookmark } from './MovieBookmark';
import { MovieStat } from './MovieStat';
import { MovieStatExternal } from './MovieStatExternal';
import { MovieVotes } from './MovieVotes';
import './MovieHero.scss';

// The feed opens with its latest movie as a wide banner over the blurred poster (web/src/partitions/MovieHero).
export function MovieHero({ movie, label }: { movie: MovieBase; label?: string }) {
  const year = yearOf(movie.release_date || movie.first_air_date);
  const genres = genreNames(movie.genres).slice(0, 3).join(', ');
  const meta = [year, genres].filter(Boolean).join(' · ');
  const poster = getPosterUrl(movie);
  const voteTime = formatVoteTime(getLastVoteTime(movie));

  return (
    <div className="movie-hero">
      {poster ? <div className="movie-hero__bg" style={{ backgroundImage: `url(${poster})` }} /> : null}
      <Link href={'/movie/' + movie.id} className="movie-hero__link">
        подробнее
      </Link>

      <div className="movie-cover movie-hero__cover">
        {poster ? (
          <div style={{ backgroundImage: `url(${poster})` }} className="movie-cover-inn">
            {/* eslint-disable-next-line @next/next/no-img-element -- the legacy markup: an invisible img for SEO */}
            <img src={poster} alt={movie.title ?? ''} />
          </div>
        ) : null}
        <MovieBookmark id={movie.id} inBookmarks={movie.inBookmarks} />
      </div>

      <div className="movie-hero__body">
        {label ? (
          <div className="movie-hero__label" suppressHydrationWarning>
            {label}
            {voteTime ? ' · ' + voteTime : ''}
          </div>
        ) : null}
        <h2 className="movie-hero__title">
          {movie.title}
          {movie.type === 'tv' ? ' (сериал)' : ''}
        </h2>
        {meta ? <div className="movie-hero__meta">{meta}</div> : null}
        <MovieStatExternal kpValue={movie.kp_rating_value} imdbValue={movie.imdb_rating_value} className="m-prev" />
        <MovieVotes votes={movie.votes} limit={5} className="movie-hero__voters" />
        {/* phones have no room for the named voters, so they get the compact userpic strip */}
        <MovieVotes votes={movie.votes} limit={4} className="movie-hero__voters-compact m-compact" />
        <div className="movie-hero__votes">
          <MovieStat
            id={movie.id}
            super={movie.super}
            likes={movie.likes}
            neutral={movie.neutral}
            dislikes={movie.dislikes}
            isSuper={movie.isSuper}
            isLiked={movie.isLiked}
            isNeutral={movie.isNeutral}
            isDisliked={movie.isDisliked}
          />
        </div>
      </div>
    </div>
  );
}
