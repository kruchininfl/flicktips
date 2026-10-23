import type { Metadata } from 'next';
import { cache } from 'react';

import type { FilmDetails, FilmVote, StaffGroup } from '@flicktips/shared';

import { orNotFound, serverApi } from '@/api/server';
import { JsonLd } from '@/components/JsonLd';
import { BackButton } from '@/components/film/BackButton';
import { FilmActions } from '@/components/film/FilmActions';
import { FilmVotes } from '@/components/film/FilmVotes';
import { MovieVoteButtons } from '@/components/film/MovieVoteButtons';
import { votable } from '@/components/film/votable';
import { People } from '@/components/film/People';
import { votesLabel } from '@/components/shell/nav';
import { SITE_URL } from '@/lib/config';
import { formatHoursMinutes, yearOf } from '@/lib/dates';
import { genreNames, getPosterUrl, VOTE_NAMES } from '@/lib/movies';
import { cn } from '@/lib/utils';
import { getViewer } from '@/viewer/server';
import { pageMetadata } from '@/lib/metadata';
import { withShareTags } from '@/lib/share-metadata';

// shared by generateMetadata and the page: one API call per request
const getMovie = cache((id: string) => orNotFound(serverApi.movies.get(id)));

const overviewOf = (movie: FilmDetails) => movie.overview || movie.tmdb_overview || movie.kp_overview || null;

function nameOf(movie: FilmDetails) {
  const year = yearOf(movie.release_date || movie.first_air_date);
  return (movie.title ?? '') + (year ? ` (${year})` : '');
}

export async function generateMetadata({ params }: PageProps<'/movie/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const { movie } = await getMovie(id);
  const name = nameOf(movie);
  const title = name + ' — FlickTips';
  const description = `Все о ${movie.type === 'tv' ? 'сериале' : 'фильме'} ${name}: оценки друзей, рейтинги кинопоиск и имдб, трейлеры, обложка, актеры и режиссеры`;
  const image = getPosterUrl(movie, true);

  return withShareTags(pageMetadata({ title, description, path: '/movie/' + movie.id, image, type: 'video.movie' }), {
    image: image || '',
    shareDescription: overviewOf(movie),
  });
}

function peopleOf(groups: StaffGroup[], role: RegExp) {
  return groups
    .filter((group) => role.test(group.type ?? ''))
    .flatMap((group) => group.people)
    .filter((person) => person.name || person.original_name)
    .slice(0, 20)
    .map((person) => ({
      '@type': 'Person',
      name: person.name || person.original_name,
      url: `${SITE_URL}/person/${person.id}`,
    }));
}

function movieJsonLd(movie: FilmDetails, poster: string | null, overview: string | null) {
  const date = movie.release_date || movie.first_air_date;
  const staff = movie.staff ?? [];
  const duration = Number(movie.kp_duration);
  const genres = genreNames(movie.genres);

  return {
    '@type': movie.type === 'tv' ? 'TVSeries' : 'Movie',
    name: movie.title,
    ...(movie.original_title && movie.original_title !== movie.title ? { alternateName: movie.original_title } : {}),
    url: `${SITE_URL}/movie/${movie.id}`,
    ...(poster ? { image: poster } : {}),
    ...(overview ? { description: overview } : {}),
    ...(yearOf(date) ? { datePublished: yearOf(date) } : {}),
    ...(genres.length ? { genre: genres } : {}),
    ...(duration > 0 && movie.type !== 'tv' ? { duration: `PT${Math.round(duration)}M` } : {}),
    ...(peopleOf(staff, /director|режисс/i).length ? { director: peopleOf(staff, /director|режисс/i) } : {}),
    ...(peopleOf(staff, /actor|актер|актёр/i).length ? { actor: peopleOf(staff, /actor|актер|актёр/i) } : {}),
  };
}

// «312 тыс. оценок»
function countLabel(count: number | null | undefined): React.ReactNode {
  if (!count) return 'нет оценок';
  if (count < 1000) return votesLabel(count);
  // phones have room for «312 тыс.» only
  return (
    <>
      {Math.round(count / 1000)} тыс.<span className="max-sm:hidden"> оценок</span>
    </>
  );
}

function ratingTone(value: number | null | undefined) {
  if (!value) return 'text-faint';
  if (value > 7) return 'text-positive';
  if (value >= 4) return 'text-warning';
  return 'text-destructive';
}

function StatCard({
  label,
  value,
  note,
  className,
  noteClassName,
}: {
  label: React.ReactNode;
  value: string;
  note: React.ReactNode;
  className?: string;
  noteClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card border border-ring bg-card p-3 shadow-card sm:px-5 sm:py-4">
      <span className="flex items-center gap-1.5 truncate type-caption text-muted-foreground">{label}</span>
      <span className={cn('type-h2 sm:type-metric', className)}>{value}</span>
      <span className={cn('truncate type-caption text-muted-foreground', noteClassName)}>{note}</span>
    </div>
  );
}

// share of «Супер» and «Нравится» among the votes
function liked(votes: FilmVote[]) {
  const good = votes.filter((vote) => VOTE_NAMES[vote.vote] === 'super' || VOTE_NAMES[vote.vote] === 'like').length;
  return { good, percent: votes.length ? Math.round((good / votes.length) * 100) : 0 };
}

// /movie/:id — Figma «Фильм»: poster with «В закладки» and «Трейлер», the ratings, the viewer's vote, the facts
// and the overview, the votes of friends (of everyone for guests or when no friend voted), cast and crew.
export default async function MoviePage({ params }: PageProps<'/movie/[id]'>) {
  const { id } = await params;
  const [{ movie }, viewer, allVotes] = await Promise.all([
    getMovie(id),
    getViewer(),
    serverApi.movies.votes(id).then(
      (response) => response.votes,
      () => [] as FilmVote[],
    ),
  ]);

  const poster = getPosterUrl(movie);
  const year = yearOf(movie.release_date || movie.first_air_date);
  const overview = overviewOf(movie);
  const genres = genreNames(movie.genres);
  const countries = (movie.countries ?? []).map((country) => country.name);
  const duration = Number(movie.kp_duration);
  const directors = (movie.staff ?? [])
    .filter((group) => group.type === 'director')
    .flatMap((group) => group.people)
    .map((person) => person.name || person.original_name)
    .filter(Boolean);
  const trailers = (movie.tmdb_trailers ?? [])
    .map((trailer) => trailer.split(':'))
    .filter(([source]) => source === 'YouTube')
    .map(([, key]) => key!);

  const friendVotes = viewer ? allVotes.filter((vote) => vote.user.isFriend) : [];
  const byFriends = friendVotes.length > 0;
  const votes = byFriends ? friendVotes : allVotes;
  const { good, percent } = liked(votes);
  const subtitle = [
    movie.original_title && movie.original_title !== movie.title ? movie.original_title : null,
    movie.type === 'tv' ? 'сериал' : null,
    year,
  ]
    .filter(Boolean)
    .join(' · ');
  const facts = [
    ['Жанр', genres.join(', ')],
    ['Страна', countries.join(', ')],
    ['Время', duration > 0 && movie.type !== 'tv' ? formatHoursMinutes(duration) : ''],
    [directors.length > 1 ? 'Режиссёры' : 'Режиссёр', directors.slice(0, 3).join(', ')],
  ].filter(([, value]) => value);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <JsonLd data={movieJsonLd(movie, getPosterUrl(movie, true), overview)} />
      <BackButton />

      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
        <aside className="flex flex-col gap-3 md:gap-2">
          <div className="relative aspect-[3/2] overflow-hidden rounded-card bg-muted md:aspect-[2/3]">
            {poster && (
              // eslint-disable-next-line @next/next/no-img-element -- posters come through the nginx cache
              <img src={poster} alt={movie.title ?? ''} className="absolute inset-0 size-full object-cover" />
            )}
          </div>
          <FilmActions id={movie.id} inBookmarks={movie.inBookmarks} trailers={trailers} />
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="type-h1-mobile sm:type-h1">{movie.title}</h1>
            {subtitle && <p className="type-large text-muted-foreground">{subtitle}</p>}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <StatCard
              label={
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG logo */}
                  <img src="/public/brand/kinopoisk.svg" width={12} height={12} alt="" />
                  Кинопоиск
                </>
              }
              value={movie.kp_rating_value ? movie.kp_rating_value.toFixed(1) : '—'}
              note={countLabel(movie.kp_rating_count)}
              className={ratingTone(movie.kp_rating_value)}
            />
            <StatCard
              label={
                <>
                  <span className="rounded-[3px] bg-[#f5c518] px-[3px] text-[8px] leading-3 font-bold text-black">
                    IMDb
                  </span>
                  IMDb
                </>
              }
              value={movie.imdb_rating_value ? movie.imdb_rating_value.toFixed(1) : '—'}
              note={countLabel(movie.imdb_rating_count)}
              className={ratingTone(movie.imdb_rating_value)}
            />
            <StatCard
              label={
                byFriends ? (
                  <>
                    Друзьям<span className="max-sm:hidden"> понравилось</span>
                  </>
                ) : (
                  'Понравилось'
                )
              }
              value={votes.length ? `${percent}%` : '—'}
              note={votes.length ? `${good} из ${votes.length}` : 'пока нет оценок'}
              noteClassName={votes.length ? 'text-positive' : undefined}
            />
          </div>

          <section className="flex flex-col gap-3 rounded-card border border-ring bg-card p-4 shadow-card sm:px-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="type-h3">Ваша оценка</h2>
              <span className="hidden type-caption text-faint sm:inline">изменить можно в любой момент</span>
            </div>
            <div className="flex gap-2">
              <MovieVoteButtons
                movie={votable(movie)}
                size="l"
                buttonClassName="max-sm:h-9 max-sm:min-w-0 max-sm:flex-1 max-sm:px-2"
              />
            </div>
            <p className="type-caption text-muted-foreground">Оценку увидят ваши друзья</p>
          </section>

          {facts.length > 0 && (
            <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-4 gap-y-2.5 sm:grid-cols-[132px_minmax(0,1fr)]">
              {facts.map(([term, value]) => (
                <div key={term} className="contents">
                  <dt className="text-muted-foreground">{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {overview && <p className="type-large">{overview}</p>}
        </div>
      </div>

      {votes.length > 0 && <FilmVotes title={byFriends ? 'Оценки друзей' : 'Оценки'} votes={votes} />}

      {movie.staff?.length ? <People groups={movie.staff} /> : null}
    </div>
  );
}
