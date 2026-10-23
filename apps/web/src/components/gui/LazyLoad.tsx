'use client';

// react-lazy-load replacement: renders `children` once the wrapper scrolls into view (or `offset` px before).
// Same markup: div.LazyLoad, plus .is-visible after it loaded. Don't wrap content that must be in the SSR HTML
// for search engines; it is meant for below-the-fold pictures (cast photos).
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cx } from '@/lib/cx';

interface LazyLoadProps {
  children: ReactNode;
  offset?: number;
  className?: string;
  height?: number | string;
}

export function LazyLoad({ children, offset = 0, className, height }: LazyLoadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: `${offset}px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [offset, visible]);

  return (
    <div
      ref={ref}
      className={cx('LazyLoad', visible && 'is-visible', className)}
      style={height ? { height } : undefined}
    >
      {visible ? children : null}
    </div>
  );
}
