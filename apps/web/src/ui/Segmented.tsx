'use client';

import { cx } from '@/lib/cx';

import styles from './Segmented.module.scss';

interface SegmentedProps<T extends string> {
  // Figma «Вкладка» (Активна / Обычная) in a muted track, e.g. «Друзья | Все оценки»
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div role="tablist" className={cx(styles.track, className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={cx(styles.tab, option.value === value && styles.active)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
