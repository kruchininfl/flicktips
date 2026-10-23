'use client';

import { useState, type AnimationEvent } from 'react';

import type { VoteCounters, VoteName, ViewerFlags } from '@flicktips/shared';

import { VoteIcon } from '@/components/gui/VoteIcon';

import { useMovieState, useVote } from './useMovieState';
import './MovieStat.scss';

const VOTES = [
  { name: 'super', id: 3, active: 'isSuper', counter: 'super' },
  { name: 'like', id: 2, active: 'isLiked', counter: 'likes' },
  { name: 'neutral', id: 1, active: 'isNeutral', counter: 'neutral' },
  { name: 'dislike', id: 0, active: 'isDisliked', counter: 'dislikes' },
] as const satisfies readonly {
  name: VoteName;
  id: number;
  active: keyof ViewerFlags;
  counter: keyof VoteCounters;
}[];

export type MovieStatProps = { id: number } & Partial<VoteCounters> & ViewerFlags;

// The four vote buttons with counters (web/src/partitions/MovieStat). Takes the movie object as props.
export function MovieStat(props: MovieStatProps) {
  const movie = useMovieState(props);
  const vote = useVote();
  // The animation runs only after a click, not when the page renders an existing vote. The vote is applied
  // after the API responds, so the clicked icon is shown optimistically meanwhile.
  const [animated, setAnimated] = useState<{ name: VoteName; on: boolean } | null>(null);

  const handleClick = (name: VoteName, isActive: boolean) => {
    setAnimated({ name, on: !isActive });
    vote(movie.id, name).catch(() => setAnimated(null));
  };

  const handleAnimationEnd = (e: AnimationEvent) => {
    if (e.target === e.currentTarget && !e.nativeEvent.pseudoElement) setAnimated(null);
  };

  return (
    <div className="movie-votes">
      {VOTES.map(({ name, id, active, counter }) => {
        const isAnimated = animated?.name === name;
        const isActive = isAnimated ? animated.on : !!movie[active];
        let className = 'movie-vote movie-vote_' + name;
        if (isActive) className += ' m-active';
        if (isAnimated) className += isActive ? ' m-pop' : ' m-unpop';

        return (
          <div key={name} onClick={() => handleClick(name, !!movie[active])} className={className}>
            <div className="movie-vote__icn" onAnimationEnd={handleAnimationEnd}>
              <VoteIcon vote={id} active={isActive} />
            </div>
            <div className="movie-vote__counter">{movie[counter] ?? 0}</div>
          </div>
        );
      })}
    </div>
  );
}
