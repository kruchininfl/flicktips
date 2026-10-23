// Client-side overrides of a movie's vote counters, the viewer's vote and bookmark. The legacy site applied
// every vote/bookmark response to all its redux reducers; here a movie rendered twice on a page (a hero and a
// list, a card and the search results) reads the same entry. Live vote counters from GET /api/events land here too
// (components/shell/LiveUpdates).
import type { VoteCounters, ViewerFlags } from '@flicktips/shared';

export type MovieState = VoteCounters & ViewerFlags;

type Listener = () => void;

const overrides = new Map<number, Partial<MovieState>>();
const listeners = new Set<Listener>();

export function subscribeMovies(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMovieOverride(id: number): Partial<MovieState> | undefined {
  return overrides.get(id);
}

export function updateMovie(id: number, patch: Partial<MovieState>): void {
  overrides.set(id, { ...overrides.get(id), ...patch });
  for (const listener of listeners) listener();
}
