'use client';

import { IconUsers } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import type { FeedResponse } from '@flicktips/shared';

import { api } from '@/api/browser';
import { FeedHero } from '@/components/film/FeedHero';
import { MovieCard, MovieGrid } from '@/components/film/MovieCard';
import { latestVotes } from '@/components/film/VoterPill';
import { useUi } from '@/components/shell/UiProvider';
import { Button } from '@/components/ui/button';
import { ToggleCount } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { VOTE_KINDS, VOTE_LABELS, VoteGlyph, type VoteKind } from '@/components/votes/votes';
import { VOTE_NAMES } from '@/lib/movies';
import { useViewer } from '@/viewer/ViewerProvider';

type Results = FeedResponse['results'];
type Movie = Results['entities'][number];
type Filter = VoteKind | 'all';

interface FeedProps {
  // the first page, loaded on the server (the friends' feed for signed-in visitors)
  initial: Results;
  initialOnlyFriends: boolean;
}

// the vote of the card's latest voter, which the filter chips go by
const latestKind = (movie: Movie): VoteKind | undefined => {
  const vote = latestVotes(movie.votes)[0];
  return vote ? VOTE_NAMES[vote.value] : undefined;
};

function Empty({ onlyFriends }: { onlyFriends: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-ring bg-card px-6 py-12 text-center shadow-card">
      <IconUsers className="size-8 text-faint" />
      <p className="max-w-[420px] text-muted-foreground">
        {onlyFriends
          ? 'Ваши друзья пока не оценивали фильмы и сериалы. Позовите их в FlickTips, чтобы видеть, что им понравилось.'
          : 'Пока нет ни одной оценки.'}
      </p>
      {onlyFriends && (
        <Button variant="outline" asChild>
          <Link href="/profile/friends/">Найти друзей</Link>
        </Button>
      )}
    </div>
  );
}

// Figma «Лента»: the «Друзья / Все оценки» switch, the latest movie as «Свежая оценка», the rest as cards with
// filters by vote, «Показать ещё». The server data is the starting point; the switch and paging re-request it.
export function Feed({ initial, initialOnlyFriends }: FeedProps) {
  const viewer = useViewer();
  const { startLoading, doneLoading } = useUi();
  const [state, setState] = useState({ initial, onlyFriends: initialOnlyFriends, results: initial });
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);

  // fresh server data (the viewer toggled "hide viewed", signed in or out): start over from it
  if (state.initial !== initial) {
    setState({ initial, onlyFriends: initialOnlyFriends, results: initial });
  }

  const { onlyFriends, results } = state;
  const [first, ...rest] = results.entities;
  const counts = new Map<Filter, number>([['all', rest.length]]);
  for (const movie of rest) {
    const kind = latestKind(movie);
    if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const shown = filter === 'all' ? rest : rest.filter((movie) => latestKind(movie) === filter);

  const load = (friends: boolean, page: number) => (friends ? api.feed.friends(page) : api.feed.lastGraded(page));

  const switchFeed = async (friends: boolean) => {
    if (friends === onlyFriends) return;
    startLoading();
    try {
      const response = await load(friends, 1);
      setState((s) => ({ ...s, onlyFriends: friends, results: response.results }));
      setFilter('all');
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
      // page N returns the first N pages at once
      const response = await load(onlyFriends, results.page + 1);
      setState((s) => ({ ...s, results: response.results }));
    } catch {
      // the error is reported by the API client
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="type-h1-mobile sm:type-h1">Лента</h1>
          <p className="text-muted-foreground">
            {onlyFriends ? 'Что посмотрели и оценили ваши друзья' : 'Что смотрят и оценивают на FlickTips'}
          </p>
        </div>
        {viewer && (
          <ToggleGroup
            type="single"
            variant="tab"
            value={onlyFriends ? 'friends' : 'all'}
            onValueChange={(value) => value && void switchFeed(value === 'friends')}
          >
            <ToggleGroupItem value="friends">Друзья</ToggleGroupItem>
            <ToggleGroupItem value="all">Все оценки</ToggleGroupItem>
          </ToggleGroup>
        )}
      </header>

      {first ? (
        <FeedHero movie={first} votersLabel={onlyFriends ? 'Оценили друзья' : 'Оценили'} />
      ) : (
        <Empty onlyFriends={onlyFriends} />
      )}

      {rest.length > 0 && (
        <section className="flex flex-col gap-4 sm:gap-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <h2 className="type-h2">{onlyFriends ? 'Недавно оценили друзья' : 'Недавние оценки'}</h2>
            <ToggleGroup
              type="single"
              variant="chip"
              value={filter}
              onValueChange={(value) => value && setFilter(value as Filter)}
              className="-mx-4 w-auto flex-nowrap overflow-x-auto px-4 sm:mx-0 sm:w-fit sm:flex-wrap sm:px-0"
            >
              <ToggleGroupItem value="all">
                Все <ToggleCount>{counts.get('all')}</ToggleCount>
              </ToggleGroupItem>
              {VOTE_KINDS.map((kind) => (
                <ToggleGroupItem key={kind} value={kind}>
                  <VoteGlyph kind={kind} />
                  {VOTE_LABELS[kind]} <ToggleCount>{counts.get(kind) ?? 0}</ToggleCount>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <MovieGrid>
            {shown.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </MovieGrid>
        </section>
      )}

      {results.page < results.pages && (
        <Button variant="outline" className="self-center" disabled={loading} onClick={() => void loadMore()}>
          {loading ? 'Загружаем…' : 'Показать ещё'}
        </Button>
      )}
    </div>
  );
}
