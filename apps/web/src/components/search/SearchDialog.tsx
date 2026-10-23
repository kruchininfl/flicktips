'use client';

import { IconMoodEmpty, IconSearch, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import type { FoundPerson, MovieBase, SearchedUser } from '@flicktips/shared';

import { api } from '@/api/browser';
import { UserAvatar } from '@/components/brand/UserAvatar';
import { movieMeta } from '@/components/film/meta';
import { MovieVoteButtons } from '@/components/film/MovieVoteButtons';
import { Ratings } from '@/components/film/Ratings';
import { votable } from '@/components/film/votable';
import { FollowIconButton } from '@/components/profile/FollowButton';
import { useUi } from '@/components/shell/UiProvider';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getPosterUrl } from '@/lib/movies';
import { compactCount, plural } from '@/lib/plural';
import { cn } from '@/lib/utils';
import { useViewer } from '@/viewer/ViewerProvider';

const MIN_QUERY_LENGTH = 2;
const RECENT_SIZE = 5;

type SearchMovie = MovieBase & { kp_rating_count?: number };

interface Results {
  query: string;
  movies: SearchMovie[];
  people: FoundPerson[];
  users: SearchedUser[];
}

// Figma «Поиск (Ctrl K)» / «Поиск» (phone): films, people and possible friends by one query; with no query (or
// nothing found) the latest votes. ↑↓ pick a row, Enter opens it, Esc closes.
export function SearchDialog() {
  const { searchOpen, openSearch, closeSearch } = useUi();
  const viewer = useViewer();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [recent, setRecent] = useState<SearchMovie[] | null>(null);
  const [active, setActive] = useState(0);

  // the latest votes, once per page load: the friends' for a signed-in viewer
  useEffect(() => {
    if (!searchOpen || recent) return;
    (viewer ? api.feed.friends() : api.feed.lastGraded())
      .then((response) => setRecent(response.results.entities.slice(0, RECENT_SIZE)))
      .catch(() => setRecent([]));
  }, [searchOpen, recent, viewer]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (value: string) => {
    const trimmed = value.trim();
    latest.current = trimmed;
    clearTimeout(timer.current);
    if ([...trimmed].length < MIN_QUERY_LENGTH) return;
    timer.current = setTimeout(() => {
      // Кинопоиск is the slow one and may be down: its failure leaves the films out, not the rest
      void Promise.all([
        api.movies.search(trimmed).then(
          (r) => r.results,
          () => [],
        ),
        api.people.search(trimmed).then(
          (r) => r.results,
          () => [],
        ),
        api.users.search(trimmed).then(
          (r) => r.results,
          () => [],
        ),
      ]).then(([movies, people, users]) => {
        if (latest.current !== trimmed) return;
        setResults({ query: trimmed, movies: movies.slice(0, 5), people, users: users.slice(0, 3) });
        setActive(0);
      });
    }, 300);
  };

  const onOpenChange = (open: boolean) => {
    if (open) {
      openSearch();
      return;
    }
    closeSearch();
    clearTimeout(timer.current);
    latest.current = '';
    setQuery('');
    setResults(null);
    setActive(0);
  };

  const trimmed = query.trim();
  const typed = [...trimmed].length >= MIN_QUERY_LENGTH;
  const current = typed && results?.query === trimmed ? results : null;
  const loading = typed && !current;
  const found = !!current && (current.movies.length > 0 || current.people.length > 0 || current.users.length > 0);

  // the rows ↑↓ walk through, in the order they are shown
  const shownMovies = found ? current.movies : (recent ?? []);
  const hrefs = [
    ...shownMovies.map((movie) => `/movie/${movie.id}`),
    ...(found ? current.people.map((person) => `/person/${person.id}`) : []),
    ...(found ? current.users.map((user) => `/user/${user.id}`) : []),
  ];

  const onKeyDown = (e: KeyboardEvent) => {
    if (!hrefs.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + step + hrefs.length) % hrefs.length);
    } else if (e.key === 'Enter' && hrefs[active]) {
      e.preventDefault();
      router.push(hrefs[active]);
      onOpenChange(false);
    }
  };

  const row = (index: number) => ({
    active: index === active,
    onHover: () => setActive(index),
    onOpen: () => onOpenChange(false),
  });

  const recentList = (
    <Section title="Последние оценки">
      {recent === null ? (
        <Skeletons />
      ) : (
        recent.map((movie, index) => <MovieRow key={movie.id} movie={movie} {...row(index)} />)
      )}
    </Section>
  );

  let body: ReactNode;
  if (loading) {
    body = (
      <Section title="Ищем…">
        <Skeletons />
      </Section>
    );
  } else if (found) {
    const peopleStart = current.movies.length;
    const usersStart = peopleStart + current.people.length;
    body = (
      <>
        {current.movies.length > 0 && (
          <Section title="Фильмы и сериалы">
            {current.movies.map((movie, index) => (
              <MovieRow key={movie.id} movie={movie} {...row(index)} />
            ))}
          </Section>
        )}
        {current.people.length > 0 && (
          <Section title="Люди">
            {current.people.map((person, index) => (
              <PersonRow key={person.id} person={person} {...row(peopleStart + index)} />
            ))}
          </Section>
        )}
        {current.users.length > 0 && (
          <Section title="Возможные друзья">
            {current.users.map((user, index) => (
              <UserRow key={user.id} user={user} {...row(usersStart + index)} />
            ))}
          </Section>
        )}
      </>
    );
  } else if (current) {
    body = (
      <>
        <div className="flex flex-col items-center gap-2 px-6 pt-8 pb-4 text-center">
          <span className="mb-2 flex size-14 items-center justify-center rounded-xl bg-muted">
            <IconMoodEmpty className="size-6 text-muted-foreground" />
          </span>
          <p className="type-h3">Ничего не нашлось</p>
          <p className="max-w-[560px] type-caption text-muted-foreground">
            По запросу «{current.query}» нет фильмов, людей и друзей. Проверьте написание или попробуйте по-английски.
          </p>
        </div>
        {recentList}
      </>
    );
  } else {
    body = recentList;
  }

  return (
    <Dialog open={searchOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        onKeyDown={onKeyDown}
        className="top-4 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[640px] translate-y-0 flex-col overflow-hidden p-0 sm:top-24 sm:max-h-[calc(100dvh-192px)]"
      >
        <DialogTitle className="sr-only">Поиск</DialogTitle>
        <DialogDescription className="sr-only">Фильмы, сериалы, люди и друзья</DialogDescription>
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <IconSearch className="size-5 shrink-0 text-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              search(e.target.value);
            }}
            autoFocus
            type="search"
            enterKeyHint="search"
            placeholder="Фильм, сериал, человек или друг"
            aria-label="Поиск"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
          />
          <kbd className="hidden font-sans type-caption text-faint sm:block">Esc</kbd>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => onOpenChange(false)}
            className="-mr-1 flex size-8 items-center justify-center rounded-full text-foreground sm:hidden"
          >
            <IconX className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">{body}</div>
        <div className="hidden h-9 shrink-0 items-center gap-4 bg-muted px-4 type-caption text-faint sm:flex">
          <span>↑↓ выбрать</span>
          <span>↵ открыть</span>
          <span>Esc закрыть</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col pt-4">
      <h3 className="px-2 pb-2 type-label text-faint uppercase">{title}</h3>
      {children}
    </section>
  );
}

interface RowProps {
  active: boolean;
  onHover: () => void;
  onOpen: () => void;
}

// a row: the whole of it opens the link; the buttons inside sit above it (`relative z-10`)
function Row({
  href,
  label,
  active,
  onHover,
  onOpen,
  className,
  children,
}: RowProps & { href: string; label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  return (
    <div
      ref={ref}
      onMouseMove={onHover}
      className={cn('relative flex items-center gap-3 rounded-lg px-2 py-2', active && 'bg-muted/60', className)}
    >
      <Link href={href} aria-label={label} tabIndex={-1} onClick={onOpen} className="absolute inset-0 rounded-lg" />
      {children}
    </div>
  );
}

function MovieRow({ movie, ...row }: RowProps & { movie: SearchMovie }) {
  const title = movie.title ?? movie.original_title ?? '';
  const poster = getPosterUrl(movie);
  const friends = movie.votes?.length ?? 0;
  const seen = [
    movie.kp_rating_count ? `Смотрели ${compactCount(movie.kp_rating_count)}` : '',
    friends ? `${friends} ${plural(friends, ['друг', 'друга', 'друзей'])}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Row href={`/movie/${movie.id}`} label={title} className="max-sm:items-start" {...row}>
      <div className="pointer-events-none h-[60px] w-10 shrink-0 overflow-hidden rounded-md bg-muted">
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element -- posters come through the nginx cache
          <img src={poster} alt="" loading="lazy" className="size-full object-cover" />
        )}
      </div>
      <div className="pointer-events-none flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{title}</span>
          {movie.type === 'tv' && (
            <Badge status="accent" dot={false}>
              Сериал
            </Badge>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2 type-caption text-muted-foreground">
          <span className="truncate">{movieMeta({ ...movie, type: null })}</span>
          <Ratings
            kp={movie.kp_rating_value}
            imdb={movie.imdb_rating_value}
            className="shrink-0 gap-2 bg-transparent p-0 shadow-none"
          />
        </div>
        {seen && <span className="truncate type-caption text-faint">{seen}</span>}
        <div className="pointer-events-auto relative z-10 mt-1.5 flex gap-1 sm:hidden">
          <MovieVoteButtons movie={votable(movie)} size="s" />
        </div>
      </div>
      <div className="relative z-10 hidden shrink-0 gap-1 sm:flex">
        <MovieVoteButtons movie={votable(movie)} size="s" />
      </div>
    </Row>
  );
}

function PersonRow({ person, ...row }: RowProps & { person: FoundPerson }) {
  const name = person.name || person.original_name || '';
  return (
    <Row href={`/person/${person.id}`} label={name} {...row}>
      <UserAvatar src={person.kp_photo} name={name} size={32} className="pointer-events-none" />
      <div className="pointer-events-none flex min-w-0 flex-col">
        <span className="truncate font-medium">{name}</span>
        {person.role && (
          <span className="truncate type-caption text-muted-foreground">{person.role.toLowerCase()}</span>
        )}
      </div>
    </Row>
  );
}

function UserRow({ user, ...row }: RowProps & { user: SearchedUser }) {
  const name = user.username || 'Без имени';
  const caption = [
    user.common_friends
      ? `${user.common_friends} ${plural(user.common_friends, ['общий друг', 'общих друга', 'общих друзей'])}`
      : '',
    `${user.votes_count} ${plural(user.votes_count, ['оценка', 'оценки', 'оценок'])}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Row href={`/user/${user.id}`} label={name} {...row}>
      <UserAvatar src={user.avatar} name={name} size={32} className="pointer-events-none" />
      <div className="pointer-events-none flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate type-caption text-muted-foreground">{caption}</span>
      </div>
      <FollowIconButton
        userId={user.id}
        subscribed={user.subscribed}
        followsMe={user.follows_me}
        className="relative z-10"
      />
    </Row>
  );
}

function Skeletons() {
  return Array.from({ length: 4 }, (_, index) => (
    <div key={index} className="flex items-center gap-3 px-2 py-2" aria-hidden>
      <div className="h-[60px] w-10 shrink-0 rounded-md bg-muted" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-3.5 rounded-full bg-muted" style={{ width: `${70 - index * 6}%` }} />
        <div className="h-3 w-1/2 rounded-full bg-muted" />
        <div className="h-3 w-1/3 rounded-full bg-muted" />
      </div>
      <div className="hidden gap-1 sm:flex">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-11 w-10 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  ));
}
