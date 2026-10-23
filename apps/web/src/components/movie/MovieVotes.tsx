import Link from 'next/link';

import type { MovieVote } from '@flicktips/shared';

import { VoteIcon } from '@/components/gui/VoteIcon';
import { Userpic } from '@/components/gui/Userpic';
import { cx } from '@/lib/cx';
import { timeAgo, unixToMs } from '@/lib/dates';

import './MovieVotes.scss';

interface MovieVotesProps {
  votes: MovieVote[] | undefined;
  className?: string;
  limit?: number;
  // 0 - hidden, 1 - all users, 2 - only friends
  filter?: number;
}

// Latest voters as userpics with their vote; the card puts them over the poster (className 'm-compact'),
// the movie page lists them with names (web/src/partitions/MovieVotes).
export function MovieVotes({ votes, className, filter = 1, limit = 3 }: MovieVotesProps) {
  if (filter === 0 || !votes || !votes.length) return null;

  const rest = votes.length - limit;
  // the API doesn't sort a feed movie's votes, and these are meant to be the latest voters
  const latest = votes.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return (
    <div className={cx('movie-user-votes', className)}>
      {latest.slice(0, limit).map((vote) => (
        <Link
          key={vote.user_id}
          href={'/user/' + vote.user_id}
          title={`${vote.user_name}, ${timeAgo(unixToMs(vote.timestamp))}`}
          className="movie-user-votes__item"
          // the relative time can differ between the server render and hydration
          suppressHydrationWarning
        >
          <Userpic avatar={vote.user_avatar} className="movie-user-votes__item-photo">
            <i className="movie-user-votes__item-vote">
              <VoteIcon vote={vote.value} active />
            </i>
          </Userpic>
          <span className="movie-user-votes__item-name">{(vote.user_name || '').split(' ')[0]}</span>
        </Link>
      ))}
      {rest > 0 ? <span className="movie-user-votes__more">+{rest}</span> : null}
    </div>
  );
}
