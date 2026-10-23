import type { ProfileStats } from '@flicktips/shared';

import { VOTE_KINDS, VOTE_LABELS, VoteGlyph } from '@/components/votes/votes';

// Figma «Распределение оценок»: one bar per vote kind, as wide as its share, and the counts under it.
export function VoteBreakdown({ title, votes }: { title: string; votes: ProfileStats['votes'] }) {
  const kinds = VOTE_KINDS.filter((kind) => votes[kind] > 0);
  if (!kinds.length) return null;

  return (
    <section className="flex flex-col gap-3.5 rounded-card border border-ring bg-card p-4 shadow-card sm:p-5">
      <h2 className="type-h3">{title}</h2>
      <div className="flex gap-[3px]" aria-hidden>
        {kinds.map((kind) => (
          <div
            key={kind}
            className="h-2.5 min-w-1.5 rounded-[5px]"
            style={{ flex: `${votes[kind]} 0 0`, background: `var(--vote-${kind})` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 type-caption">
        {VOTE_KINDS.map((kind) => (
          <li key={kind} className="flex items-center gap-1.5">
            <VoteGlyph kind={kind} />
            <span className="text-muted-foreground">{VOTE_LABELS[kind]}</span>
            <span className="font-medium text-foreground">{votes[kind]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
