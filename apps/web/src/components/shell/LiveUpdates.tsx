'use client';

// Live vote counters (the legacy socket.io `vote-changed` listener in App.jsx): while a viewer is signed in, the
// shell keeps an EventSource on GET /api/events and writes every vote change into lib/movie-store, so each copy
// of the movie on the open page updates. The viewer's own votes from other tabs also carry their flags.
import { useEffect } from 'react';

import type { LiveEventMap } from '@flicktips/shared';

import { EVENTS_PATH } from '@/api/endpoints';
import { updateMovie } from '@/lib/movie-store';
import { useViewer } from '@/viewer/ViewerProvider';

// After the browser gives up (the API was down, or answered 401/429), try again after this, doubling up to the max.
const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;

export function LiveUpdates() {
  const viewerId = useViewer()?.id ?? null;

  useEffect(() => {
    if (viewerId === null || typeof EventSource === 'undefined') return;

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryMs = RETRY_MIN_MS;
    let stopped = false;

    const onVote = (event: MessageEvent<string>) => {
      let data: LiveEventMap['vote'];
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      const { id, ...patch } = data;
      if (typeof id === 'number') updateMovie(id, patch);
    };

    const connect = () => {
      source = new EventSource(EVENTS_PATH, { withCredentials: true });
      source.addEventListener('vote', onVote);
      source.addEventListener('open', () => {
        retryMs = RETRY_MIN_MS;
      });
      // while CONNECTING the browser reconnects by itself (the API ends each stream after a while); CLOSED means
      // it stopped trying
      source.addEventListener('error', () => {
        if (stopped || source?.readyState !== EventSource.CLOSED) return;
        source.close();
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
      });
    };
    connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [viewerId]);

  return null;
}
