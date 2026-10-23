import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from '@/lib/cx';

import styles from './IconButton.module.scss';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // Figma «Кнопка-иконка»: Тип = Контур / Призрак
  variant?: 'outline' | 'ghost';
  // 36px buttons in the top bar, 40px squares in the collapsed sidebar
  size?: 36 | 40;
  label: string;
  // a dot in the corner (new notifications, friend requests)
  dot?: boolean;
  children: ReactNode;
}

export function IconButton({
  variant = 'ghost',
  size = 36,
  label,
  dot,
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(styles.button, styles[variant], size === 40 && styles.square, className)}
    >
      {children}
      {dot && <span className={styles.dot} />}
    </button>
  );
}
