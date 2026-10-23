import type { ReactNode } from 'react';

import { cx } from '@/lib/cx';

import styles from './Badge.module.scss';

// Figma «Бейдж»: Статус = Успех / Внимание / Ошибка / Акцент / Нейтральный
export type BadgeStatus = 'positive' | 'warning' | 'destructive' | 'accent' | 'neutral';

export function Badge({
  status = 'neutral',
  dot = true,
  children,
}: {
  status?: BadgeStatus;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={cx(styles.badge, styles[status])}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}
