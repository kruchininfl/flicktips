import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from '@/lib/cx';

import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'accent';

interface ButtonOwnProps {
  // Figma «Кнопка»: Тип = Основная / Контур / Призрак / Акцент, Размер = M (36px) / S (32px)
  variant?: ButtonVariant;
  size?: 'm' | 's';
  icon?: ReactNode;
  block?: boolean;
  className?: string;
  children?: ReactNode;
}

type ButtonProps = ButtonOwnProps &
  (({ href: string } & { onClick?: never }) | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>));

export function Button({ variant = 'primary', size = 'm', icon, block, className, children, ...rest }: ButtonProps) {
  const classes = cx(styles.button, styles[variant], styles[size], block && styles.block, className);
  const content = (
    <>
      {icon}
      {children}
    </>
  );
  if (rest.href !== undefined) {
    return (
      <Link href={rest.href} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" {...rest} className={classes}>
      {content}
    </button>
  );
}
