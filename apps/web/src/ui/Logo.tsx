import Link from 'next/link';

import { cx } from '@/lib/cx';

import styles from './Logo.module.scss';

// «Знак FlickTips»: the flame («Супер») with the poo («Не нравится») inside.
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a static SVG, nothing for next/image to optimise
  return <img src="/public/brand/mark.svg" width={size} height={size} alt="" className={className} />;
}

// «Логотип»: the mark and the flick/tips wordmark, a link to the feed.
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cx(styles.logo, className)} aria-label="FlickTips">
      <Mark />
      <span className={styles.word}>
        flick<em>tips</em>
      </span>
    </Link>
  );
}
