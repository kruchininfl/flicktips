'use client';

import { useState } from 'react';

import type { BookmarkMovie, Paged } from '@flicktips/shared';

import { api } from '@/api/browser';
import { Button } from '@/components/gui/Button';
import { PagePlaceholder } from '@/components/gui/PagePlaceholder';
import { MoviePreview } from '@/components/movie/MoviePreview';
import { useMovieState } from '@/components/movie/useMovieState';

function BookmarkItem({ movie }: { movie: BookmarkMovie }) {
  const state = useMovieState(movie);

  return (
    <MoviePreview
      className={'profile__bookmarks-item' + (state.inBookmarks ? '' : ' m-inactive')}
      movie={state}
      votesFilter={0}
    />
  );
}

// The viewer's bookmarks with the "Показать еще" paging. A removed bookmark stays in the list, dimmed.
export function BookmarksList({ initial }: { initial: Paged<BookmarkMovie> }) {
  const [bookmarks, setBookmarks] = useState(initial);
  const [loading, setLoading] = useState(false);

  const handleLoadData = () => {
    if (loading) return;
    setLoading(true);
    api.me
      .bookmarks({ page: bookmarks.page + 1 })
      .then(({ results }) => setBookmarks({ ...results, entities: [...bookmarks.entities, ...results.entities] }))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  if (!bookmarks.total) return <PagePlaceholder icon="bookmark-book" text="У вас нет закладок" />;

  return (
    <>
      <div className="movie-prev-list">
        {bookmarks.entities.map((entity) => (
          <BookmarkItem key={entity.id} movie={entity} />
        ))}
      </div>

      {bookmarks.pages > bookmarks.page ? (
        <Button onClick={handleLoadData} loading={loading} className="btn_more">
          Показать еще
        </Button>
      ) : null}
    </>
  );
}
