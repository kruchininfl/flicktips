import React, {Component} from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import 'moment/locale/ru';
import MovieStat from 'partitions/MovieStat';
import MovieStatExternal from 'partitions/MovieStatExternal';
import config from 'config';

import './MoviePreview.scss';
import {getVoteIconClassById} from '../../helpers';
import {Link} from 'react-router';
import MovieBookmark from '../MovieBookmark/MovieBookmark';
import MovieVotes from '../MovieVotes';

const propTypes = {
  children   : PropTypes.node,
  movie      : PropTypes.any,
  className  : PropTypes.string,
  votesFilter: PropTypes.number
};

class MoviePreview extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {movie, votesFilter, className} = this.props;

    movie.genres = movie.genres ? movie.genres.map((el) => el.name || el) : [];
    movie.date = movie.release_date || movie.first_air_date;

    return (
      <div className={'movie-prev ' + (className ? className : '')}>
        {this.props.children}

        <Link to={'/movie/' + movie.id} className="movie-prev__link">подробнее</Link>

        <MovieVotes filter={votesFilter} className="movie-prev__friends-votes" votes={movie.votes} />

        <div className="movie-cover movie-cover__prev">
          {movie.tmdb_poster_path
            ? <div
              style={{backgroundImage: `url(${config.tmdb.posterPath342 + movie.tmdb_poster_path})`}}
              className="movie-cover-inn"
            >
              <img src={config.tmdb.posterPath342 + movie.tmdb_poster_path}
                alt={movie.title}
              />
            </div>
            : ''
          }
          {typeof movie.vote !== 'undefined'
            ? <div className="movie-vote-icn"><i className={'icn ' + getVoteIconClassById(movie.vote, true)} /></div>
            : ''
          }
          <MovieBookmark id={movie.id} inBookmarks={movie.inBookmarks} />
        </div>

        <div className="movie-prev__content">
          {movie.title
            ? <h2 className="movie-title" title={movie.title}>{movie.title}{movie.type === 'tv' ? ' (сериал)' : ''}</h2>
            : ''
          }

          {movie.original_title || movie.date
            ? <div className="movie-ot-y">
              {movie.original_title
                ? <div className="movie-ot" title={movie.original_title}>{movie.original_title}</div>
                : ''
              }

              {movie.date && moment(movie.date).isValid()
                ? <div className="movie-y">{moment(movie.date).format('YYYY') + 'г'}</div>
                : ''
              }
            </div>
            : ''
          }

          {movie.genres.length
            ? <div className="movie-genres">{movie.genres.join(', ')}</div>
            : ''
          }

          <MovieStatExternal
            kpValue={movie.kp_rating_value}
            imdbValue={movie.imdb_rating_value}
            additionClass="m-prev"
          />

          <div className="movie-prev__votes">
            <MovieStat {...movie} />
          </div>
        </div>
      </div>
    );
  }
}

MoviePreview.propTypes = propTypes;

export default MoviePreview;