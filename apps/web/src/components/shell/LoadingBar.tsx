'use client';

// The thin bar at the top of the header (react-redux-loading-bar in the legacy site, which showed it while a
// page loaded its data). It runs from a click on an internal link until the new URL renders, and while
// anything calls useUi().startLoading()/doneLoading().
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useUi } from './UiProvider';

const UPDATE_TIME = 100;
const MAX_PROGRESS = 90;
const PROGRESS_INCREASE = 10;
const TERMINATING_TIME = UPDATE_TIME / 2;

const noSubscribe = () => () => {};

function isInternalNavigation(event: MouseEvent): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false;
  }
  const link = (event.target as Element | null)?.closest?.('a');
  if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return false;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // the OAuth start and other API routes leave the app
  if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/')) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

export function LoadingBar({ className }: { className?: string }) {
  const { loading } = useUi();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const [percent, setPercent] = useState(0);
  // false during SSR and hydration, like the legacy bar that rendered only in the browser
  const mounted = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const active = navigating || loading > 0;
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) setNavigating(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // a new URL has rendered
  const url = pathname + '?' + searchParams.toString();
  const [renderedUrl, setRenderedUrl] = useState(url);
  if (renderedUrl !== url) {
    setRenderedUrl(url);
    setNavigating(false);
  }

  // start from zero, or jump to the end when it stops
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    setPercent((p) => (active ? 0 : p > 0 ? 100 : 0));
  }

  useEffect(() => {
    if (active) {
      timer.current = setInterval(() => {
        setPercent((p) => {
          const next = p + PROGRESS_INCREASE * Math.cos(p * (Math.PI / 2 / 100));
          return next <= MAX_PROGRESS ? next : p;
        });
      }, UPDATE_TIME);
      return () => clearInterval(timer.current);
    }
    const reset = setTimeout(() => setPercent(0), UPDATE_TIME + TERMINATING_TIME);
    return () => clearTimeout(reset);
  }, [active]);

  if (!mounted) return <div />;

  const shown = percent > 0 && percent <= 100;
  return (
    <div>
      <div
        className={className}
        style={{
          opacity: shown ? 1 : 0,
          transform: `scaleX(${percent / 100})`,
          transformOrigin: 'left',
          transition: `transform ${percent !== 100 ? UPDATE_TIME * 4 : TERMINATING_TIME}ms linear`,
          width: '100%',
          willChange: 'transform, opacity',
        }}
      />
      <div style={{ display: 'table', clear: 'both' }} />
    </div>
  );
}
