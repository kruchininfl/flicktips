import type { Metadata } from 'next';
import { cache } from 'react';

import type { FilmDetails, StaffGroup } from '@flicktips/shared';

import { orNotFound, serverApi } from '@/api/server';
import { JsonLd } from '@/components/JsonLd';
import { MovieBookmark } from '@/components/movie/MovieBookmark';
import { MovieDescription } from '@/components/movie/MovieDescription';
import { MovieStaff } from '@/components/movie/MovieStaff';
import { MovieStat } from '@/components/movie/MovieStat';
import { MovieStatExternal } from '@/components/movie/MovieStatExternal';
import { MovieTrailer } from '@/components/movie/MovieTrailer';
import { MovieVotes } from '@/components/movie/MovieVotes';
import { MovieVotesPopup } from '@/components/movie/MovieVotesPopup';
import { SITE_URL } from '@/lib/config';
import { formatDuration, yearOf } from '@/lib/dates';
import { genreNames, getPosterUrl } from '@/lib/movies';
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

export default async function MoviePage({ params }: PageProps<'/movie/[id]'>) {
  const { id } = await params;
  const { movie } = await getMovie(id);

  const poster = getPosterUrl(movie);
  const date = movie.release_date || movie.first_air_date;
  const year = yearOf(date);
  const overview = overviewOf(movie);
  const genres = genreNames(movie.genres);
  const countries = (movie.countries ?? []).map((country) => country.name);
  const duration = Number(movie.kp_duration);
  const trailers = (movie.tmdb_trailers ?? [])
    .map((trailer) => trailer.split(':'))
    .filter(([source]) => source === 'YouTube')
    .map(([, key]) => key!);

  return (
    <div className="content movie">
      <JsonLd data={movieJsonLd(movie, getPosterUrl(movie, true), overview)} />

      {poster ? <div className="movie__backdrop" style={{ backgroundImage: `url(${poster})` }} /> : null}

      <div className="movie__head">
        <div className="movie-cover movie__cover">
          {poster ? (
            <div style={{ backgroundImage: `url(${poster})` }} className="movie-cover-inn">
              {/* eslint-disable-next-line @next/next/no-img-element -- the legacy markup: an invisible img for SEO */}
              <img src={poster} alt={movie.title ?? ''} />
            </div>
          ) : null}
          <MovieBookmark id={movie.id} inBookmarks={movie.inBookmarks} />
        </div>

        <div className="movie__info">
          {movie.title ? (
            <h1 className="movie-title movie__title" title={movie.title}>
              {movie.title}
              {movie.type === 'tv' ? ' (сериал)' : ''}
            </h1>
          ) : null}

          {movie.original_title || year ? (
            <div className="movie-ot-y">
              {movie.original_title ? <div className="movie-ot">{movie.original_title}</div> : null}
              {year ? <div className="movie-y">{year + 'г'}</div> : null}
            </div>
          ) : null}

          {genres.length ? <div className="movie-genres">{genres.join(', ')}</div> : null}

          {countries.length || duration > 0 ? (
            <div className="movie-c-d">
              {countries.length ? <span className="movie-countries">{countries.join(', ')}</span> : null}
              {duration > 0 ? (
                <span className="movie-duration">
                  {formatDuration(duration)}
                  {duration < 60 ? ' мин.' : ''}
                </span>
              ) : null}
            </div>
          ) : null}

          <MovieStatExternal
            kpValue={movie.kp_rating_value}
            imdbValue={movie.imdb_rating_value}
            className="m-details"
          />
        </div>

        <div className="movie__votes">
          <MovieStat
            id={movie.id}
            super={movie.super}
            likes={movie.likes}
            neutral={movie.neutral}
            dislikes={movie.dislikes}
            isSuper={movie.isSuper}
            isLiked={movie.isLiked}
            isNeutral={movie.isNeutral}
            isDisliked={movie.isDisliked}
          />
        </div>

        {movie.votes?.length ? (
          <div className="movie__voters">
            <div className="movie__section-title">Последние оценки</div>
            <MovieVotes votes={movie.votes} limit={8} className="movie__voters-list" />
          </div>
        ) : null}

        <div className="movie__buttons">
          <MovieVotesPopup
            movieId={movie.id}
            super={movie.super}
            likes={movie.likes}
            neutral={movie.neutral}
            dislikes={movie.dislikes}
          />

          <MovieTrailer trailers={trailers} />
        </div>

        {overview ? <MovieDescription>{overview}</MovieDescription> : null}
      </div>

      {movie.staff?.length ? <MovieStaff groups={movie.staff} /> : null}

      <div id="commento" />
    </div>
  );
}
