import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from '@/lib/cx';

import styles from './Chip.module.scss';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // Figma «Фильтр»: Состояние = Обычный / Выбран
  selected?: boolean;
  count?: number | string;
  icon?: ReactNode;
  children: ReactNode;
}

export function Chip({ selected, count, icon, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...rest}
      className={cx(styles.chip, selected && styles.selected, className)}
    >
      {icon}
      <span>{children}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </button>
  );
}
