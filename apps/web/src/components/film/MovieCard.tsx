import Link from 'next/link';

import type { MovieBase } from '@flicktips/shared';

import { getPosterUrl } from '@/lib/movies';
import { cn } from '@/lib/utils';

import { BookmarkButton } from './BookmarkButton';
import { movieMeta } from './meta';
import { MovieVoteButtons } from './MovieVoteButtons';
import { votable } from './votable';
import { Ratings } from './Ratings';
import { latestVotes, MoreVoters, VoterPill } from './VoterPill';

// Figma «Карточка фильма»: the poster with the latest voter, the bookmark, the ratings and the four votes, then
// the title and «год · жанры». Works in Server and Client Components.
export function MovieCard({ movie, className }: { movie: MovieBase; className?: string }) {
  const href = '/movie/' + movie.id;
  const poster = getPosterUrl(movie);
  const votes = latestVotes(movie.votes);
  const title = movie.title ?? movie.original_title ?? '';

  return (
    <article className={cn('group flex min-w-0 flex-col gap-2', className)}>
      <div className="relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-md bg-muted p-2">
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element -- posters come through the nginx cache
          <img src={poster} alt={title} loading="lazy" className="absolute inset-0 size-full object-cover" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[140px] bg-gradient-to-b from-transparent to-black/60" />
        <Link href={href} aria-label={title} tabIndex={-1} className="absolute inset-0" />

        <div className="pointer-events-none relative flex items-center gap-1.5 *:pointer-events-auto">
          {votes[0] && <VoterPill vote={votes[0]} />}
          <MoreVoters count={votes.length - 1} />
          <BookmarkButton id={movie.id} inBookmarks={movie.inBookmarks} className="ml-auto" />
        </div>

        <div className="pointer-events-none relative flex flex-col items-center gap-2 *:pointer-events-auto">
          <Ratings kp={movie.kp_rating_value} imdb={movie.imdb_rating_value} />
          <div className="flex w-full gap-1">
            <MovieVoteButtons movie={votable(movie)} size="s" buttonClassName="w-auto min-w-0 flex-1" />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <Link href={href} className="truncate font-semibold hover:underline" title={title}>
          {title}
        </Link>
        <span className="truncate type-caption text-muted-foreground">{movieMeta(movie)}</span>
      </div>
    </article>
  );
}

// The card grid: 2 columns on phones, then as many ~200px columns as fit (3 on tablets, 5 on a 1440 desktop).
export function MovieGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] sm:gap-x-6 sm:gap-y-8">
      {children}
    </div>
  );
}
