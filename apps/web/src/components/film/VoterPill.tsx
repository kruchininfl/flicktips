import type { MovieVote } from '@flicktips/shared';

import { UserAvatar } from '@/components/brand/UserAvatar';
import { VoteGlyph } from '@/components/votes/votes';
import { formatCardTime } from '@/lib/dates';
import { VOTE_NAMES } from '@/lib/movies';

export const firstName = (name: string | null | undefined) => (name ?? '').split(' ')[0] ?? '';

// Figma «Кто и когда»: the latest voter on a poster, their vote and when. `you`: the viewer, named «Вы».
export function VoterPill({ vote, you = false }: { vote: MovieVote; you?: boolean }) {
  const kind = VOTE_NAMES[vote.value];
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-2xl bg-black/55 py-[3px] pr-2.5 pl-2 backdrop-blur-[6px] sm:pl-[3px]">
      <UserAvatar src={vote.user_avatar} name={vote.user_name} size={24} className="border-0 max-sm:hidden" />
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1 text-xs leading-[15px] font-medium text-white">
          <span className="min-w-0 truncate">{you ? 'Вы' : firstName(vote.user_name)}</span>
          {kind && (
            <span className="shrink-0">
              <VoteGlyph kind={kind} size={12} />
            </span>
          )}
        </span>
        <span className="truncate text-[10px] leading-3 text-white/75" suppressHydrationWarning>
          <span className="sm:hidden">{formatCardTime(vote.timestamp, undefined, true)}</span>
          <span className="max-sm:hidden">{formatCardTime(vote.timestamp)}</span>
        </span>
      </div>
    </div>
  );
}

// «+3»: the other voters
export function MoreVoters({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="shrink-0 rounded-xl bg-white/90 px-2 py-[3px] text-xs leading-4 font-medium text-[#141414] backdrop-blur-[6px]">
      +{count}
    </span>
  );
}

// The movie's votes, latest first (the API doesn't sort a feed movie's votes).
export function latestVotes(votes: MovieVote[] | undefined): MovieVote[] {
  return (votes ?? []).slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}
