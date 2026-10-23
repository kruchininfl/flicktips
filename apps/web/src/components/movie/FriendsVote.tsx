'use client';

import Link from 'next/link';
import { useState, type MouseEvent } from 'react';

import type { FriendsVote as FriendsVoteDto } from '@flicktips/shared';

import { Userpic } from '@/components/gui/Userpic';
import { VoteIcon } from '@/components/gui/VoteIcon';
import { formatShortDate } from '@/lib/dates';

import { MoviePreview } from './MoviePreview';
import './FriendsVote.scss';

type FriendsVoteProps = Pick<FriendsVoteDto, 'vote' | 'timestamp' | 'movie' | 'user' | 'isNew'> & {
  closeSidebar: () => void;
};

// One friend's vote in the notifications panel, with the movie sliding out (web/src/partitions/FriendsVote).
export function FriendsVote({ vote, timestamp, movie, user, isNew, closeSidebar }: FriendsVoteProps) {
  const [openedMovie, setOpenedMovie] = useState(false);

  const toggleMovie = (e: MouseEvent) => {
    e.stopPropagation();
    setOpenedMovie((o) => !o);
  };

  return (
    <div className={'friend-vote' + (isNew ? ' m-new' : '')}>
      <Link href={'/user/' + user.id} className="friend-vote__main">
        <div className="friend-vote__main-left">
          <Userpic avatar={user.avatar} />

          <div className="friend-vote__date" suppressHydrationWarning>
            {formatShortDate(timestamp * 1000)}
          </div>
        </div>

        <div className="friend-vote__main-text">
          <span className="friend-vote__username link">{user.name}</span>
          <span className="friend-vote__vote">
            <VoteIcon vote={vote} active />
          </span>

          <div className="friend-vote__movie-title movie-prev__title">
            {movie.title ? <strong>{movie.title}</strong> : null}
            {movie.original_title ? (
              <span>
                {movie.title ? ' / ' : ''}
                {movie.original_title}
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      <div onClick={closeSidebar} className={'friend-vote__movie' + (openedMovie ? ' m-active' : '')}>
        <MoviePreview movie={{ ...movie, type: null }} />
        <div className="friend-vote__movie-toggle" onClick={toggleMovie} />
      </div>
    </div>
  );
}
