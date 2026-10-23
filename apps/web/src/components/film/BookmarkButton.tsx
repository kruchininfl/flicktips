'use client';

import { IconBookmark, IconBookmarkFilled } from '@tabler/icons-react';

import { useMovieState, useToggleBookmark } from '@/components/movie/useMovieState';
import { cn } from '@/lib/utils';

// Figma «В закладки» on a poster: always there once bookmarked, otherwise on hover (and always on touch screens).
export function BookmarkButton({
  id,
  inBookmarks,
  className,
}: {
  id: number;
  inBookmarks?: boolean;
  className?: string;
}) {
  const state = useMovieState({ id, inBookmarks });
  const toggle = useToggleBookmark();
  const active = !!state.inBookmarks;
  const label = active ? 'Убрать из закладок' : 'В закладки';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={() => void toggle(id).catch(() => {})}
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full bg-white/95 text-[#0c0a09] shadow-[0_2px_8px_#00000033] transition-opacity outline-none focus-visible:ring-[3px] focus-visible:ring-brand-line',
        !active && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
        className,
      )}
    >
      {active ? <IconBookmarkFilled className="size-4" /> : <IconBookmark className="size-4" />}
    </button>
  );
}
