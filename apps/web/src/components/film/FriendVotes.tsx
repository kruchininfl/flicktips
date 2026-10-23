import Link from 'next/link';

import type { MovieVote } from '@flicktips/shared';

import { UserAvatar } from '@/components/brand/UserAvatar';
import { VoteGlyph } from '@/components/votes/votes';
import { VOTE_NAMES } from '@/lib/movies';
import { cn } from '@/lib/utils';

import { firstName } from './VoterPill';

// Figma «Оценка друга»: the avatar with the vote in its corner and the first name, a link to the profile.
export function FriendVotes({ votes, className }: { votes: MovieVote[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {votes.map((vote) => {
        const kind = VOTE_NAMES[vote.value];
        return (
          <Link
            key={vote.user_id}
            href={'/user/' + vote.user_id}
            title={vote.user_name ?? undefined}
            className="flex w-14 flex-col items-center gap-1.5"
          >
            <span className="relative">
              <UserAvatar src={vote.user_avatar} name={vote.user_name} size={40} />
              {kind && (
                <span className="absolute -right-1.5 -bottom-1 flex size-5 items-center justify-center rounded-full bg-card">
                  <VoteGlyph kind={kind} size={13} />
                </span>
              )}
            </span>
            <span className="max-w-full truncate type-caption text-muted-foreground">{firstName(vote.user_name)}</span>
          </Link>
        );
      })}
    </div>
  );
}
