import Link from 'next/link';
import type { MouseEventHandler, ReactNode } from 'react';

import { cx } from '@/lib/cx';

import { Icon, type IconName } from './Icon';
import { Spinner } from './Spinner';

export interface ButtonProps {
  children?: ReactNode;
  // extra classes (legacy `additionClass`)
  className?: string;
  // .btn_color_<color>
  color?: 'gray' | 'green' | 'blue' | 'light-gray';
  // .btn_size_<size>
  size?: 'big';
  // .btn_style_<variant> (legacy `style`)
  variant?: 'border';
  // an icon of components/gui/Icon before the text
  icn?: IconName | 'soc_ya';
  disabled?: boolean;
  loading?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  // client-side navigation (next/link)
  to?: string;
  // full-page navigation, e.g. the OAuth start URL (with `target`/`rel` for external links)
  href?: string;
  target?: string;
  rel?: string;
  title?: string;
  // BEM block, 'btn' by default (legacy `dfClass`)
  block?: string;
}

// The legacy Gui/Button: a <span> (or a link) with .btn__inn/.btn__text and a spinner shown while `loading`.
export function Button({
  children,
  className,
  color,
  size,
  variant,
  icn,
  disabled = false,
  loading = false,
  onClick,
  to,
  href,
  target,
  rel,
  title,
  block = 'btn',
}: ButtonProps) {
  const classes = cx(
    block,
    className,
    disabled && `${block}_disabled`,
    loading && `${block}_loading`,
    color && `${block}_color_${color}`,
    size && `${block}_size_${size}`,
    variant && `${block}_style_${variant}`,
  );
  const inner = (
    <>
      <span className={`${block}__inn`}>
        {icn ? <Icon name={icn} className={`${block}__icn`} /> : null}
        <span className={`${block}__text`}>{children}</span>
      </span>
      <Spinner className={`${block}__spinner`} active={loading} size="small" />
    </>
  );

  if (to) {
    return (
      <Link href={to} className={classes} onClick={onClick} title={title}>
        {inner}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={classes} onClick={onClick} title={title}>
        {inner}
      </a>
    );
  }
  return (
    <span
      className={classes}
      onClick={disabled || loading ? undefined : onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onKeyDown={
        onClick && !disabled && !loading
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                (e.currentTarget as HTMLElement).click();
              }
            }
          : undefined
      }
      title={title}
    >
      {inner}
    </span>
  );
}
