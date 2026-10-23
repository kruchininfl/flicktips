'use client';

import {
  IconBookmark,
  IconBookmarkFilled,
  IconChevronLeft,
  IconChevronRight,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { useState } from 'react';

import { useMovieState, useToggleBookmark } from '@/components/movie/useMovieState';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// «В закладки» and «Трейлер» under the poster of the film page. `trailers` are YouTube video ids.
export function FilmActions({ id, inBookmarks, trailers }: { id: number; inBookmarks?: boolean; trailers: string[] }) {
  const state = useMovieState({ id, inBookmarks });
  const toggle = useToggleBookmark();
  const [index, setIndex] = useState(0);
  const active = !!state.inBookmarks;

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
      <Button variant="outline" aria-pressed={active} onClick={() => void toggle(id).catch(() => {})}>
        {active ? <IconBookmarkFilled /> : <IconBookmark />}
        {active ? 'В закладках' : 'В закладки'}
      </Button>
      {trailers.length > 0 && (
        <Dialog onOpenChange={(open) => open && setIndex(0)}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <IconPlayerPlay />
              Трейлер
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl p-3 pt-14 sm:p-4 sm:pt-14">
            <DialogTitle className="absolute top-4 left-5">
              Трейлер{trailers.length > 1 ? ` ${index + 1} из ${trailers.length}` : ''}
            </DialogTitle>
            <div className="aspect-video overflow-hidden rounded-md bg-black">
              <iframe
                key={trailers[index]}
                src={`https://www.youtube.com/embed/${encodeURIComponent(trailers[index]!)}?autoplay=1&rel=0`}
                title="Трейлер"
                className="size-full"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              />
            </div>
            {trailers.length > 1 && (
              <div className="mt-3 flex justify-center gap-2">
                <Button variant="outline" size="s" disabled={index <= 0} onClick={() => setIndex(index - 1)}>
                  <IconChevronLeft />
                  Предыдущий
                </Button>
                <Button
                  variant="outline"
                  size="s"
                  disabled={index >= trailers.length - 1}
                  onClick={() => setIndex(index + 1)}
                >
                  Следующий
                  <IconChevronRight />
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
