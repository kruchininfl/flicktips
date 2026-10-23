import { IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';

import type { MovieBase } from '@flicktips/shared';

import { UserAvatar } from '@/components/brand/UserAvatar';
import { Button } from '@/components/ui/button';
import { formatCardTime } from '@/lib/dates';
import { getPosterUrl } from '@/lib/movies';

import { BookmarkButton } from './BookmarkButton';
import { FriendVotes } from './FriendVotes';
import { movieMeta } from './meta';
import { MovieVoteButtons, votable } from './MovieVoteButtons';
import { Ratings } from './Ratings';
import { firstName, latestVotes, MoreVoters, VoterPill } from './VoterPill';

// Figma «Свежая оценка»: the feed opens with its latest movie in a card. Phones put a small poster next to the
// title and the rest below.
export function FeedHero({ movie, votersLabel }: { movie: MovieBase; votersLabel: string }) {
  const href = '/movie/' + movie.id;
  const poster = getPosterUrl(movie);
  const votes = latestVotes(movie.votes);
  const title = movie.title ?? movie.original_title ?? '';
  const latest = votes[0];

  return (
    <section className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 rounded-card border border-ring bg-card p-4 shadow-card sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-x-7 sm:p-6">
      <div className="group relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-md bg-muted p-2 sm:row-span-2">
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element -- posters come through the nginx cache
          <img src={poster} alt={title} className="absolute inset-0 size-full object-cover" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[90px] bg-gradient-to-b from-transparent to-black/50" />
        <Link href={href} aria-label={title} tabIndex={-1} className="absolute inset-0" />
        <div className="pointer-events-none relative flex items-center gap-1.5 *:pointer-events-auto">
          {latest && (
            <span className="hidden min-w-0 sm:flex">
              <VoterPill vote={latest} />
            </span>
          )}
          <span className="hidden sm:inline">
            <MoreVoters count={votes.length - 1} />
          </span>
          <BookmarkButton id={movie.id} inBookmarks={movie.inBookmarks} className="ml-auto opacity-100" />
        </div>
        <Ratings
          kp={movie.kp_rating_value}
          imdb={movie.imdb_rating_value}
          className="pointer-events-none relative hidden self-center sm:inline-flex"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        {latest && (
          <div className="flex items-center gap-1.5 sm:hidden">
            <UserAvatar src={latest.user_avatar} name={latest.user_name} size={24} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-xs leading-[15px] font-medium">{firstName(latest.user_name)}</span>
              <span className="text-[10px] leading-3 text-muted-foreground" suppressHydrationWarning>
                {formatCardTime(latest.timestamp)}
              </span>
            </span>
            {votes.length > 1 && (
              <span className="rounded-xl bg-muted px-2 py-[3px] text-xs leading-4 font-medium">
                +{votes.length - 1}
              </span>
            )}
          </div>
        )}
        <h2 className="type-h3 sm:type-h1">
          <Link href={href} className="hover:underline">
            {title}
          </Link>
        </h2>
        <p className="text-muted-foreground">{movieMeta(movie, 3)}</p>
        <Ratings
          kp={movie.kp_rating_value}
          imdb={movie.imdb_rating_value}
          className="self-start shadow-none sm:hidden"
        />
      </div>

      <div className="col-span-2 flex min-w-0 flex-col gap-3 sm:col-span-1 sm:col-start-2">
        {votes.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="type-label text-muted-foreground">
              {votersLabel} · {votes.length}
            </span>
            <FriendVotes votes={votes.slice(0, 8)} className="max-sm:[&>a:nth-child(n+6)]:hidden" />
          </div>
        )}
        <div className="flex gap-2">
          <MovieVoteButtons
            movie={votable(movie)}
            size="l"
            buttonClassName="max-sm:h-9 max-sm:min-w-0 max-sm:flex-1 max-sm:px-2"
          />
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link href={href}>
              Подробнее
              <IconArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
