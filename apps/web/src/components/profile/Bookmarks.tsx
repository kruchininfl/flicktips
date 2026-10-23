'use client';

import { IconBookmark } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import type { BookmarkMovie, Paged } from '@flicktips/shared';

import { api } from '@/api/browser';
import { MovieCard, MovieGrid } from '@/components/film/MovieCard';
import { fromFriendVotes } from '@/components/film/VoterPill';
import { useMovieState } from '@/components/movie/useMovieState';
import { useUi } from '@/components/shell/UiProvider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { plural } from '@/lib/plural';
import { cn } from '@/lib/utils';

type Kind = 'all' | 'movie' | 'tv';

// a removed bookmark stays in the list, dimmed, so it can be put back
function BookmarkCard({ movie }: { movie: BookmarkMovie }) {
  const { inBookmarks } = useMovieState(movie);
  return (
    <MovieCard
      movie={movie}
      votes={fromFriendVotes(movie.friend_votes)}
      className={cn('transition-opacity', !inBookmarks && 'opacity-50')}
    />
  );
}

// Figma «Закладки»: «Все / Фильмы / Сериалы», «Друзьям понравилось», the cards, «Показать ещё». The filters
// re-request the list from the API.
export function Bookmarks({ initial }: { initial: Paged<BookmarkMovie> }) {
  const { startLoading, doneLoading } = useUi();
  const [kind, setKind] = useState<Kind>('all');
  const [liked, setLiked] = useState(false);
  const [results, setResults] = useState(initial);
  const [loading, setLoading] = useState(false);

  const load = (filter: { kind: Kind; liked: boolean }, page: number) =>
    api.me.bookmarks({ page, type: filter.kind === 'all' ? undefined : filter.kind, liked: filter.liked });

  const applyFilter = async (filter: { kind: Kind; liked: boolean }) => {
    startLoading();
    try {
      const response = await load(filter, 1);
      setResults(response.results);
      setKind(filter.kind);
      setLiked(filter.liked);
    } catch {
      // the error is reported by the API client
    } finally {
      doneLoading();
    }
  };

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await load({ kind, liked }, results.page + 1);
      setResults((r) => ({ ...response.results, entities: [...r.entities, ...response.results.entities] }));
    } catch {
      // the error is reported by the API client
    } finally {
      setLoading(false);
    }
  };

  const filtered = kind !== 'all' || liked;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="type-h1-mobile sm:type-h1">Закладки</h1>
        <p className="text-muted-foreground">
          {initial.total
            ? `${initial.total} ${plural(initial.total, ['фильм', 'фильма', 'фильмов'])}, которые вы хотите посмотреть`
            : 'Фильмы, которые вы хотите посмотреть'}
        </p>
      </header>

      {initial.total > 0 && (
        <div className="-mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 sm:-mt-4">
          <ToggleGroup
            type="single"
            variant="tab"
            value={kind}
            onValueChange={(value) => value && void applyFilter({ kind: value as Kind, liked })}
          >
            <ToggleGroupItem value="all">Все</ToggleGroupItem>
            <ToggleGroupItem value="movie">Фильмы</ToggleGroupItem>
            <ToggleGroupItem value="tv">Сериалы</ToggleGroupItem>
          </ToggleGroup>
          <label className="flex cursor-pointer items-center gap-2.5">
            <Switch checked={liked} onCheckedChange={(checked) => void applyFilter({ kind, liked: checked })} />
            Друзьям понравилось
          </label>
        </div>
      )}

      {results.entities.length > 0 ? (
        <MovieGrid>
          {results.entities.map((movie) => (
            <BookmarkCard key={movie.id} movie={movie} />
          ))}
        </MovieGrid>
      ) : filtered ? (
        <p className="py-8 text-center text-muted-foreground">Под эти фильтры ничего не подходит</p>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-card border border-ring bg-card px-6 py-12 text-center shadow-card">
          <IconBookmark className="size-8 text-faint" />
          <p className="max-w-[420px] text-muted-foreground">
            Здесь будут фильмы и сериалы, которые вы отложили на потом. Нажмите на закладку на постере, чтобы добавить
            фильм.
          </p>
          <Button variant="outline" asChild>
            <Link href="/">В ленту</Link>
          </Button>
        </div>
      )}

      {results.page < results.pages && (
        <Button variant="outline" className="self-center" disabled={loading} onClick={() => void loadMore()}>
          {loading ? 'Загружаем…' : 'Показать ещё'}
        </Button>
      )}
    </div>
  );
}
