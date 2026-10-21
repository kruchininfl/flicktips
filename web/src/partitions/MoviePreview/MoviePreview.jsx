import React, {Component} from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import 'moment/locale/ru';
import MovieStat from 'partitions/MovieStat';
import MovieStatExternal from 'partitions/MovieStatExternal';
import {getPosterUrl} from 'helpers';

import './MoviePreview.scss';
import VoteIcon from 'components/Gui/VoteIcon';
import {Link} from 'react-router';
import MovieBookmark from '../MovieBookmark/MovieBookmark';
import MovieVotes from '../MovieVotes';
import {updateAndGetFilmPoster} from '../../redux/actions/movieActions';
import {connect} from 'react-redux';
import {formatVoteTime, getLastVoteTime} from 'helpers';

const propTypes = {
  children   : PropTypes.node,
  dispatch   : PropTypes.func,
  movie      : PropTypes.any,
  className  : PropTypes.string,
  votesFilter: PropTypes.number
};

class MoviePreview extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    const {movie} = this.props;
    const poster = getPosterUrl(movie);

    // no poster at all: ask the API to look for one right away
    if (!poster) {
      this.props.dispatch(updateAndGetFilmPoster(movie.id));
      return;
    }

    const img = document.createElement('img');

    img.addEventListener('error', () => {
      this.props.dispatch(updateAndGetFilmPoster(movie.id));
    });
    img.src = poster;
  }

  render() {
    const {movie, votesFilter, className} = this.props;

    movie.genres = movie.genres
      ? movie.genres.map((el) => (typeof el === 'string' ? el : el && el.name)).filter(Boolean)
      : [];
    movie.date = movie.release_date || movie.first_air_date;

    const year = movie.date && moment(movie.date).isValid() ? moment(movie.date).format('YYYY') : '';
    const poster = getPosterUrl(movie);
    const meta = [year, movie.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ');
    const voteTime = formatVoteTime(getLastVoteTime(movie));

    return (
      <div className={'movie-prev ' + (className ? className : '')}>
        {this.props.children}

        <Link to={'/movie/' + movie.id} className="movie-prev__link">подробнее</Link>

        <div className="movie-cover movie-cover__prev">
          {poster
            ? <div
              style={{backgroundImage: `url(${poster})`}}
              className="movie-cover-inn"
            >
              <img src={poster}
                alt={movie.title}
              />
            </div>
            : ''
          }
          {typeof movie.vote !== 'undefined'
            ? <div className="movie-vote-icn"><VoteIcon vote={movie.vote} active /></div>
            : ''
          }
          <MovieBookmark id={movie.id} inBookmarks={movie.inBookmarks} />
          <MovieVotes filter={votesFilter} className="movie-prev__friends-votes m-compact" votes={movie.votes} />
        </div>

        <div className="movie-prev__content">
          {movie.title
            ? <h2 className="movie-title" title={movie.title}>{movie.title}{movie.type === 'tv' ? ' (сериал)' : ''}</h2>
            : ''
          }

          {meta ? <div className="movie-prev__meta" title={movie.original_title}>{meta}</div> : ''}
          {voteTime ? <div className="movie-prev__time">{voteTime}</div> : ''}

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

export default connect()(MoviePreview);