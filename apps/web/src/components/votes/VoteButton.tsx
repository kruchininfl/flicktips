import { cva } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

import { VOTE_ICONS, VOTE_LABELS, type VoteKind } from './votes';

// Figma «Оценка»: Тип, Состояние = Обычная / Выбрана, Размер = S (on posters) / M / L.
const voteVariants = cva(
  'inline-flex items-center justify-center border border-transparent bg-muted text-sm font-medium whitespace-nowrap text-muted-foreground transition-[background-color,border-color] duration-150 outline-none not-aria-pressed:hover:border-border-strong focus-visible:ring-[3px] focus-visible:ring-brand-line',
  {
    variants: {
      size: {
        m: 'h-8 gap-1.5 rounded-full px-2.5 [&_svg]:size-4',
        l: 'h-11 gap-2 rounded-full px-4 font-semibold [&_svg]:size-5',
        // the icon above the count; the chosen one filled with the accent
        s: 'w-11 flex-col gap-0.5 rounded-xl px-1 py-1.5 leading-normal [&_svg]:size-4 aria-pressed:bg-brand aria-pressed:text-[#1a140d]',
      },
    },
    defaultVariants: { size: 'm' },
  },
);

const SELECTED: Record<VoteKind, string> = {
  super: 'border-vote-super-line bg-vote-super-tint [&_svg]:text-vote-super',
  like: 'border-vote-like-line bg-vote-like-tint [&_svg]:text-vote-like',
  neutral: 'border-vote-neutral-line bg-vote-neutral-tint [&_svg]:text-vote-neutral',
  dislike: 'border-vote-dislike-line bg-vote-dislike-tint [&_svg]:text-vote-dislike',
};

interface VoteButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  kind: VoteKind;
  selected?: boolean;
  size?: 's' | 'm' | 'l';
  count?: number;
}

export function VoteButton({ kind, selected, size = 'm', count, className, ...rest }: VoteButtonProps) {
  const Glyph = selected ? VOTE_ICONS[kind].filled : VOTE_ICONS[kind].outline;
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      aria-label={VOTE_LABELS[kind]}
      title={VOTE_LABELS[kind]}
      {...rest}
      className={cn(voteVariants({ size }), selected && size !== 's' && [SELECTED[kind], 'text-foreground'], className)}
    >
      <Glyph aria-hidden />
      {count !== undefined && <span>{count}</span>}
    </button>
  );
}
