'use client';

import { useCallback, useSyncExternalStore } from 'react';

import type { VoteName } from '@flicktips/shared';

import { api } from '@/api/browser';
import { getMovieOverride, subscribeMovies, updateMovie, type MovieState } from '@/lib/movie-store';
import { useUi } from '@/components/shell/UiProvider';
import { useViewer } from '@/viewer/ViewerProvider';

const noOverride = () => undefined;

// The movie as the server sent it, with the counters/flags changed since on this page applied on top.
export function useMovieState<T extends Partial<MovieState> & { id: number }>(movie: T): T {
  const override = useSyncExternalStore(subscribeMovies, () => getMovieOverride(movie.id), noOverride);
  return override ? { ...movie, ...override } : movie;
}

// POST /api/me/votes for a movie; guests get the sign-in popup instead.
export function useVote() {
  const viewer = useViewer();
  const { openSignIn } = useUi();

  return useCallback(
    async (movieId: number, vote: VoteName) => {
      if (!viewer) {
        openSignIn();
        return;
      }
      const { data } = await api.me.vote(movieId, vote);
      const { id, ...state } = data;
      updateMovie(id, state);
    },
    [viewer, openSignIn],
  );
}

// POST /api/me/bookmarks/toggle; guests get the sign-in popup instead.
export function useToggleBookmark() {
  const viewer = useViewer();
  const { openSignIn } = useUi();

  return useCallback(
    async (movieId: number) => {
      if (!viewer) {
        openSignIn();
        return;
      }
      const { data } = await api.me.toggleBookmark(movieId);
      updateMovie(data.movie_id, { inBookmarks: data.inBookmarks });
    },
    [viewer, openSignIn],
  );
}
