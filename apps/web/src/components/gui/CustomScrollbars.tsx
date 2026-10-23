'use client';

// react-custom-scrollbars replacement: native scrolling with the browser scrollbar hidden and the legacy
// .scrollbar__* track/thumb (styles/app.scss) drawn on top. Vertical only; the site never scrolled sideways.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface Thumb {
  top: number;
  height: number;
}

export function CustomScrollbars({ children, className }: { children: ReactNode; className?: string }) {
  const view = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);

  const measure = useCallback(() => {
    const el = view.current;
    if (!el || el.scrollHeight <= el.clientHeight) {
      setThumb(null);
      return;
    }
    const height = Math.max(30, (el.clientHeight / el.scrollHeight) * el.clientHeight);
    const top = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * (el.clientHeight - height);
    setThumb({ top, height });
  }, []);

  useEffect(() => {
    const el = view.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      className={'scrollbar' + (className ? ' ' + className : '')}
      style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}
    >
      <div
        ref={view}
        onScroll={() => measure()}
        style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}
      >
        <div>{children}</div>
      </div>
      {thumb ? (
        <div className="scrollbar__vertical" style={{ width: 6 }}>
          <div
            className="scrollbar__thumb-vertical"
            style={{ position: 'relative', top: thumb.top, height: thumb.height }}
          />
        </div>
      ) : null}
    </div>
  );
}
