import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import {Link} from 'react-router';
import config from 'config';
import MovieStat from 'partitions/MovieStat';
import MovieStatExternal from 'partitions/MovieStatExternal';
import MovieBookmark from '../MovieBookmark/MovieBookmark';
import MovieVotes from '../MovieVotes';

import './MovieHero.scss';

const propTypes = {
  movie: PropTypes.object.isRequired,
  label: PropTypes.string
};

// The feed opens with its latest movie as a wide banner over the blurred poster
export default function MovieHero({movie, label}) {
  const date = movie.release_date || movie.first_air_date;
  const year = date && moment(date).isValid() ? moment(date).format('YYYY') : '';
  // genres come as {id, name} from the API or as names once MoviePreview has mapped them; a genre without a name is skipped
  const genres = (movie.genres || []).map((g) => (typeof g === 'string' ? g : g && g.name)).filter(Boolean)
    .slice(0, 3).join(', ');
  const meta = [year, genres].filter(Boolean).join(' · ');
  const poster = movie.tmdb_poster_path ? config.tmdb.posterPath342 + movie.tmdb_poster_path : null;

  return (
    <div className="movie-hero">
      {poster ? <div className="movie-hero__bg" style={{backgroundImage: `url(${poster})`}} /> : null}
      <Link to={'/movie/' + movie.id} className="movie-hero__link">подробнее</Link>

      <div className="movie-cover movie-hero__cover">
        {poster
          ? <div style={{backgroundImage: `url(${poster})`}} className="movie-cover-inn">
            <img src={poster} alt={movie.title} />
          </div>
          : ''
        }
        <MovieBookmark id={movie.id} inBookmarks={movie.inBookmarks} />
      </div>

      <div className="movie-hero__body">
        {label ? <div className="movie-hero__label">{label}</div> : null}
        <h2 className="movie-hero__title">{movie.title}{movie.type === 'tv' ? ' (сериал)' : ''}</h2>
        {meta ? <div className="movie-hero__meta">{meta}</div> : null}
        <MovieStatExternal
          kpValue={movie.kp_rating_value}
          imdbValue={movie.imdb_rating_value}
          additionClass="m-prev"
        />
        <MovieVotes votes={movie.votes} limit={5} className="movie-hero__voters" />
        <div className="movie-hero__votes">
          <MovieStat {...movie} />
        </div>
      </div>
    </div>
  );
}

MovieHero.propTypes = propTypes;