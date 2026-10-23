'use client';

import { IconStar } from '@tabler/icons-react';
import { useState } from 'react';

import type { MovieVote, Paged, ProfileStats, PublicUser, UserVoteMovie } from '@flicktips/shared';

import { api } from '@/api/browser';
import { MovieCard, MovieGrid } from '@/components/film/MovieCard';
import { useUi } from '@/components/shell/UiProvider';
import { Button } from '@/components/ui/button';
import { ToggleCount } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { VOTE_KINDS, VOTE_LABELS, VoteGlyph, type VoteKind } from '@/components/votes/votes';
import { formatMonthYear } from '@/lib/dates';
import { pluralGender } from '@/lib/gender';

type Filter = VoteKind | 'all';

interface UserVotesProps {
  user: PublicUser;
  isMyPage: boolean;
  votes: ProfileStats['votes'] | null;
  initial: Paged<UserVoteMovie>;
}

// the pill on a card: the profile owner's vote, then the viewer's friends who voted too
function cardVotes(movie: UserVoteMovie, user: PublicUser): MovieVote[] {
  const own: MovieVote = {
    user_id: user.id,
    user_name: user.username,
    user_avatar: user.avatar,
    value: movie.vote,
    timestamp: Number(movie.timestamp),
  };
  const friends = (movie.friend_votes ?? [])
    .filter((vote) => vote.user_id !== user.id)
    .map((vote) => ({
      user_id: vote.user_id,
      user_name: vote.user_name,
      user_avatar: vote.user_avatar,
      value: vote.vote,
      timestamp: vote.vote_timestamp,
    }));
  return [own, ...friends];
}

// the votes split into months, newest first as the API returns them
function byMonth(movies: UserVoteMovie[]): [string, UserVoteMovie[]][] {
  const groups: [string, UserVoteMovie[]][] = [];
  for (const movie of movies) {
    const month = formatMonthYear(movie.timestamp);
    const last = groups.at(-1);
    if (last && last[0] === month) last[1].push(movie);
    else groups.push([month, [movie]]);
  }
  return groups;
}

// Figma «Мои оценки»: the filters by vote with the counts, the cards by month, «Показать ещё». A filter
// re-requests the list from the API.
export function UserVotes({ user, isMyPage, votes, initial }: UserVotesProps) {
  const { startLoading, doneLoading } = useUi();
  const [filter, setFilter] = useState<Filter>('all');
  const [results, setResults] = useState(initial);
  const [loading, setLoading] = useState(false);

  const load = (kind: Filter, page: number) =>
    api.users.votes(user.id, { page, vote: kind === 'all' ? undefined : kind });

  const changeFilter = async (kind: Filter) => {
    if (kind === filter) return;
    startLoading();
    try {
      const response = await load(kind, 1);
      setResults(response.results);
      setFilter(kind);
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
      const response = await load(filter, results.page + 1);
      setResults((r) => ({ ...response.results, entities: [...r.entities, ...response.results.entities] }));
    } catch {
      // the error is reported by the API client
    } finally {
      setLoading(false);
    }
  };

  const total = votes ? Object.values(votes).reduce((sum, n) => sum + n, 0) : initial.total;

  if (!total) {
    const text = isMyPage
      ? 'У вас пока нет оценок. Оцените фильмы, которые уже посмотрели, и они появятся здесь.'
      : `${user.username || 'Пользователь'} пока не ${pluralGender(user.gender, ['ставил', 'ставила', 'ставил(а)'])} оценок`;
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-ring bg-card px-6 py-12 text-center shadow-card">
        <IconStar className="size-8 text-faint" />
        <p className="max-w-[420px] text-muted-foreground">{text}</p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <h2 className="type-h2">{isMyPage ? 'Мои оценки' : 'Оценки'}</h2>
        <ToggleGroup
          type="single"
          variant="chip"
          value={filter}
          onValueChange={(value) => value && void changeFilter(value as Filter)}
          className="-mx-4 w-auto flex-nowrap overflow-x-auto px-4 sm:mx-0 sm:w-fit sm:flex-wrap sm:px-0"
        >
          <ToggleGroupItem value="all">
            Все <ToggleCount>{total}</ToggleCount>
          </ToggleGroupItem>
          {VOTE_KINDS.map((kind) => (
            <ToggleGroupItem key={kind} value={kind}>
              <VoteGlyph kind={kind} />
              {VOTE_LABELS[kind]} {votes && <ToggleCount>{votes[kind]}</ToggleCount>}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {results.entities.length === 0 && <p className="py-8 text-center text-muted-foreground">Таких оценок пока нет</p>}

      {byMonth(results.entities).map(([month, movies]) => (
        <div key={month} className="flex flex-col gap-4 sm:gap-6">
          <h3 className="type-label text-muted-foreground" suppressHydrationWarning>
            {month}
          </h3>
          <MovieGrid>
            {movies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                votes={cardVotes(movie, user)}
                youId={isMyPage ? user.id : undefined}
              />
            ))}
          </MovieGrid>
        </div>
      ))}

      {results.page < results.pages && (
        <Button variant="outline" className="self-center" disabled={loading} onClick={() => void loadMore()}>
          {loading ? 'Загружаем…' : 'Показать ещё'}
        </Button>
      )}
    </section>
  );
}
