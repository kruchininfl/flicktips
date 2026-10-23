'use client';

import { IconChevronDown } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import type { FilmVote } from '@flicktips/shared';

import { UserAvatar } from '@/components/brand/UserAvatar';
import { ToggleCount } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { VOTE_KINDS, VOTE_LABELS, VoteGlyph, type VoteKind } from '@/components/votes/votes';
import { votesLabel } from '@/components/shell/nav';
import { timeAgo } from '@/lib/dates';
import { VOTE_NAMES } from '@/lib/movies';

type Filter = VoteKind | 'all';

// 'YYYY-MM-DD HH:MM:SS' as the API stores it (Moscow time)
export const filmVoteMs = (timestamp: string) => Date.parse(timestamp.replace(' ', 'T') + '+03:00');

function when(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days < 1 && new Date(ms).getDate() === new Date().getDate()) return 'сегодня';
  if (days < 2) return 'вчера';
  return timeAgo(ms);
}

const SHOWN = 5;

// Figma «Оценки друзей» on the film page: filters by vote, the first five, «Показать все N оценки».
export function FilmVotes({ title, votes }: { title: string; votes: FilmVote[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState(false);

  const counts = new Map<Filter, number>([['all', votes.length]]);
  for (const vote of votes) {
    const kind = VOTE_NAMES[vote.vote];
    if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const filtered = filter === 'all' ? votes : votes.filter((vote) => VOTE_NAMES[vote.vote] === filter);
  const shown = expanded ? filtered : filtered.slice(0, SHOWN);

  return (
    <section className="flex flex-col rounded-card border border-ring bg-card p-4 shadow-card sm:px-5 sm:py-4">
      <div className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="type-h3">{title}</h2>
        <ToggleGroup
          type="single"
          variant="chip"
          value={filter}
          onValueChange={(value) => value && setFilter(value as Filter)}
          className="-mx-4 w-auto flex-nowrap overflow-x-auto px-4 sm:mx-0 sm:w-fit sm:flex-wrap sm:px-0"
        >
          <ToggleGroupItem value="all">
            Все <ToggleCount>{votes.length}</ToggleCount>
          </ToggleGroupItem>
          {VOTE_KINDS.filter((kind) => counts.get(kind)).map((kind) => (
            <ToggleGroupItem key={kind} value={kind}>
              <VoteGlyph kind={kind} />
              {VOTE_LABELS[kind]} <ToggleCount>{counts.get(kind)}</ToggleCount>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <ul className="flex flex-col">
        {shown.map((vote) => {
          const kind = VOTE_NAMES[vote.vote];
          return (
            <li key={vote.id} className="flex h-[53px] items-center gap-3 border-t border-border">
              <Link href={'/user/' + vote.user.id} className="flex min-w-0 flex-1 items-center gap-3">
                <UserAvatar src={vote.user.avatar} name={vote.user.username} size={32} />
                <span className="truncate">{vote.user.username}</span>
              </Link>
              {kind && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <VoteGlyph kind={kind} size={16} />
                  {VOTE_LABELS[kind]}
                </span>
              )}
              <span className="hidden w-32 text-right type-caption text-faint sm:block" suppressHydrationWarning>
                {when(filmVoteMs(vote.timestamp))}
              </span>
            </li>
          );
        })}
      </ul>

      {filtered.length > SHOWN && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 self-start rounded-full px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <IconChevronDown className="size-4" />
          Показать все {votesLabel(filtered.length)}
        </button>
      )}
    </section>
  );
}
