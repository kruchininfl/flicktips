import type { ReactNode } from 'react';

import { cx } from '@/lib/cx';

interface UserpicProps {
  avatar: string | null | undefined;
  className?: string;
  // .userpic_size_big
  size?: 'big';
  // extra content inside (the vote badge of MovieVotes)
  children?: ReactNode;
}

// The round avatar of styles/app.scss (.userpic): a camera placeholder until the picture covers it.
export function Userpic({ avatar, className, size, children }: UserpicProps) {
  return (
    <span className={cx('userpic', size && `userpic_size_${size}`, className)}>
      <span style={avatar ? { backgroundImage: `url(${avatar})` } : undefined} />
      {children}
    </span>
  );
}
