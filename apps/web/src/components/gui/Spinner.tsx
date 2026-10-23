import type { HTMLAttributes } from 'react';

import { cx } from '@/lib/cx';

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  size?: 'small';
}

// Five bouncing bars (.spinner in styles/app.scss); hidden unless `active`.
export function Spinner({ active = false, size, className, ...props }: SpinnerProps) {
  return (
    <div className={cx('spinner', active && 'spinner_active', size && `spinner_size_${size}`, className)} {...props}>
      <div className="spinner__rect1">&nbsp;</div>
      <div className="spinner__rect2">&nbsp;</div>
      <div className="spinner__rect3">&nbsp;</div>
      <div className="spinner__rect4">&nbsp;</div>
      <div className="spinner__rect5">&nbsp;</div>
    </div>
  );
}
