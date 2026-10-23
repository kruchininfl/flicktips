import Link from 'next/link';

import { cn } from '@/lib/utils';

// «Знак FlickTips»: the flame («Супер») with the poo («Не нравится») inside.
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a static SVG, nothing for next/image to optimise
  return <img src="/public/brand/mark.svg" width={size} height={size} alt="" className={cn('shrink-0', className)} />;
}

// «Логотип»: the mark and the flick/tips wordmark, a link to the feed.
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('inline-flex items-center gap-1.5 text-foreground', className)} aria-label="FlickTips">
      <Mark />
      <span className="type-logo whitespace-nowrap">
        flick<span className="text-brand-text">tips</span>
      </span>
    </Link>
  );
}
