import Link from 'next/link';
import type { ReactNode } from 'react';

import type { MovieBase } from '@flicktips/shared';

import { VoteIcon } from '@/components/gui/VoteIcon';
import { formatVoteTime, yearOf } from '@/lib/dates';
import { genreNames, getLastVoteTime, getPosterUrl } from '@/lib/movies';

import { MovieBookmark } from './MovieBookmark';
import { MovieStat } from './MovieStat';
import { MovieStatExternal } from './MovieStatExternal';
import { MovieVotes } from './MovieVotes';
import './MoviePreview.scss';

export interface MoviePreviewMovie extends MovieBase {
  // the profile owner's vote (a user's votes list)
  vote?: number;
  timestamp?: number | string;
}

interface MoviePreviewProps {
  movie: MoviePreviewMovie;
  className?: string;
  // MovieVotes filter: 0 - hidden, 1 - all users, 2 - only friends
  votesFilter?: number;
  children?: ReactNode;
}

// The movie card of every list (web/src/partitions/MoviePreview): poster with the vote/bookmark badges and the
// latest voters, title, year and genres, ratings, the vote buttons. Put cards in a `.movie-prev-list` to get the
// grid on tablets and up. Works in Server and Client Components.
export function MoviePreview({ movie, className, votesFilter, children }: MoviePreviewProps) {
  const genres = genreNames(movie.genres);
  const year = yearOf(movie.release_date || movie.first_air_date);
  const poster = getPosterUrl(movie);
  const meta = [year, genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ');
  const voteTime = formatVoteTime(getLastVoteTime(movie));

  return (
    <div className={'movie-prev ' + (className ?? '')}>
      {children}

      <Link href={'/movie/' + movie.id} className="movie-prev__link">
        подробнее
      </Link>

      <div className="movie-cover movie-cover__prev">
        {poster ? (
          <div style={{ backgroundImage: `url(${poster})` }} className="movie-cover-inn">
            {/* eslint-disable-next-line @next/next/no-img-element -- the legacy markup: an invisible img for SEO */}
            <img src={poster} alt={movie.title ?? ''} />
          </div>
        ) : null}
        {movie.vote !== undefined ? (
          <div className="movie-vote-icn">
            <VoteIcon vote={movie.vote} active />
          </div>
        ) : null}
        <MovieBookmark id={movie.id} inBookmarks={movie.inBookmarks} />
        <MovieVotes filter={votesFilter} className="movie-prev__friends-votes m-compact" votes={movie.votes} />
      </div>

      <div className="movie-prev__content">
        {movie.title ? (
          <h2 className="movie-title" title={movie.title}>
            {movie.title}
            {movie.type === 'tv' ? ' (сериал)' : ''}
          </h2>
        ) : null}

        {meta ? (
          <div className="movie-prev__meta" title={movie.original_title ?? undefined}>
            {meta}
          </div>
        ) : null}
        {voteTime ? (
          <div className="movie-prev__time" suppressHydrationWarning>
            {voteTime}
          </div>
        ) : null}

        <MovieStatExternal kpValue={movie.kp_rating_value} imdbValue={movie.imdb_rating_value} className="m-prev" />

        <div className="movie-prev__votes">
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
