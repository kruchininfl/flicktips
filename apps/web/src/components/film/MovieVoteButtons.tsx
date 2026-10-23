'use client';

import type { VoteCounters, ViewerFlags } from '@flicktips/shared';

import { useMovieState, useVote } from '@/components/movie/useMovieState';
import { VoteButton } from '@/components/votes/VoteButton';
import type { VoteKind } from '@/components/votes/votes';

const VOTES = [
  { kind: 'super', counter: 'super', flag: 'isSuper' },
  { kind: 'like', counter: 'likes', flag: 'isLiked' },
  { kind: 'neutral', counter: 'neutral', flag: 'isNeutral' },
  { kind: 'dislike', counter: 'dislikes', flag: 'isDisliked' },
] as const satisfies readonly { kind: VoteKind; counter: keyof VoteCounters; flag: keyof ViewerFlags }[];

export type VotableMovie = { id: number } & Partial<VoteCounters> & ViewerFlags;

// The four votes of a movie with their counters: S on posters, L on the hero and the film page. A click votes
// (guests get the sign-in popup); the counters come back from the API.
export function MovieVoteButtons({
  movie,
  size,
  buttonClassName,
}: {
  movie: VotableMovie;
  size: 's' | 'm' | 'l';
  buttonClassName?: string;
}) {
  const state = useMovieState(movie);
  const vote = useVote();

  return VOTES.map(({ kind, counter, flag }) => (
    <VoteButton
      key={kind}
      kind={kind}
      size={size}
      selected={!!state[flag]}
      count={state[counter] ?? 0}
      onClick={() => void vote(movie.id, kind).catch(() => {})}
      className={buttonClassName}
    />
  ));
}

// The movie's own vote fields, for passing a big row object to a client component.
export function votable(movie: VotableMovie): VotableMovie {
  const { id, super: superCount, likes, neutral, dislikes, isSuper, isLiked, isNeutral, isDisliked } = movie;
  return { id, super: superCount, likes, neutral, dislikes, isSuper, isLiked, isNeutral, isDisliked };
}
