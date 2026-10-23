import type { ButtonHTMLAttributes } from 'react';

import { cx } from '@/lib/cx';

import styles from './VoteButton.module.scss';
import { VOTE_ICONS, VOTE_LABELS, type VoteKind } from './votes';

interface VoteButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  // Figma «Оценка»: Тип, Состояние = Обычная / Выбрана, Размер = S (on posters) / M / L
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
      aria-pressed={selected}
      aria-label={VOTE_LABELS[kind]}
      title={VOTE_LABELS[kind]}
      {...rest}
      className={cx(styles.vote, styles[size], styles[kind], selected && styles.selected, className)}
    >
      <Glyph aria-hidden />
      {count !== undefined && <span>{count}</span>}
    </button>
  );
}
