import {
  IconFlame,
  IconFlameFilled,
  IconHeart,
  IconHeartBroken,
  IconHeartBrokenFilled,
  IconHeartFilled,
  IconPoo,
  IconPooFilled,
  type Icon,
} from '@tabler/icons-react';

export type VoteKind = 'super' | 'like' | 'neutral' | 'dislike';

export const VOTE_KINDS: readonly VoteKind[] = ['super', 'like', 'neutral', 'dislike'];

export const VOTE_LABELS: Record<VoteKind, string> = {
  super: 'Супер',
  like: 'Нравится',
  neutral: 'Так себе',
  dislike: 'Не нравится',
};

export const VOTE_ICONS: Record<VoteKind, { outline: Icon; filled: Icon }> = {
  super: { outline: IconFlame, filled: IconFlameFilled },
  like: { outline: IconHeart, filled: IconHeartFilled },
  neutral: { outline: IconHeartBroken, filled: IconHeartBrokenFilled },
  dislike: { outline: IconPoo, filled: IconPooFilled },
};

// The filled icon in the vote's colour («Оценка друга», chips of the vote filters).
export function VoteGlyph({ kind, size = 14 }: { kind: VoteKind; size?: number }) {
  const Glyph = VOTE_ICONS[kind].filled;
  return <Glyph size={size} style={{ color: `var(--vote-${kind})` }} aria-hidden />;
}
