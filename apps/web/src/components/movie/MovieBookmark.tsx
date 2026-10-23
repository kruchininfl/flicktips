'use client';

import { Icon } from '@/components/gui/Icon';

import { useMovieState, useToggleBookmark } from './useMovieState';
import './MovieBookmark.scss';

// The bookmark badge on a poster (web/src/partitions/MovieBookmark).
export function MovieBookmark({ id, inBookmarks = false }: { id: number; inBookmarks?: boolean }) {
  const state = useMovieState({ id, inBookmarks });
  const toggle = useToggleBookmark();
  const active = !!state.inBookmarks;

  return (
    <div
      onClick={() => void toggle(id)}
      className={'movie-bookmark' + (active ? ' m-active' : '')}
      title={active ? 'Убрать из закладок' : 'В закладки'}
    >
      <Icon name={active ? 'bookmark-fill' : 'bookmark'} className="movie-bookmark__icn" />
    </div>
  );
}
