import type { VoteCounters, ViewerFlags } from '@flicktips/shared';

export type VotableMovie = { id: number } & Partial<VoteCounters> & ViewerFlags;

// The movie's own vote fields, for passing a big row object to a client component (MovieVoteButtons). Not in that
// 'use client' module, so Server Components can call it.
export function votable(movie: VotableMovie): VotableMovie {
  const { id, super: superCount, likes, neutral, dislikes, isSuper, isLiked, isNeutral, isDisliked } = movie;
  return { id, super: superCount, likes, neutral, dislikes, isSuper, isLiked, isNeutral, isDisliked };
}
