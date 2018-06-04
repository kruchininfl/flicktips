import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import './MoviePage.scss';
import {asyncConnect}  from 'redux-connect';
import {getFilm} from 'redux/actions/movieActions';
import MovieStatExternal from '../../partitions/MovieStatExternal/MovieStatExternal';
import config from '../../config';
import moment from 'moment';
import 'moment/locale/ru';
import 'moment-duration-format';
import MovieStat from '../../partitions/MovieStat/MovieStat';
import MovieBookmark from '../../partitions/MovieBookmark/MovieBookmark';
import {Helmet} from 'react-helmet';
import LazyLoad from 'react-lazy-load';
import {Link} from 'react-router';

const propTypes = {
  dispatch: PropTypes.func,
  pending : PropTypes.bool,
  loaded  : PropTypes.bool,
  response: PropTypes.any
};

@asyncConnect([
  {
    key    : 'movie',
    promise: ({params, store}) => {
      return store.dispatch(getFilm(params && params.id ? params.id : null));
    }
  }
], mapStateToProps)

class MoviePage extends Component {
  constructor(props) {
    super(props);

    this.renderStaffGroup = this.renderStaffGroup.bind(this);
    this.handleToggleDesc = this.handleToggleDesc.bind(this);

    this.state = {
      openedDesc: false
    };
  }

  componentDidMount() {
    window.scrollTo(0, 0);

    const node = ReactDOM.findDOMNode(this);

    if (node) {
      node.parentNode.classList.add('m-movie');
    }
  }

  componentWillUnmount() {
    const node = ReactDOM.findDOMNode(this);

    if (node) {
      node.parentNode.classList.remove('m-movie');
    }
  }

  handleToggleDesc() {
    this.setState({openedDesc: !this.state.openedDesc});
  }

  renderStaffGroup(group, groupKey) {
    if (!group || !group.people || !group.people.length) {
      return false;
    }

    return (<div key={groupKey}
      className="movie__staff-group"
    >
      <div className="movie__staff-group-title">{group.title}</div>
      <div className="movie__staff-group-list">
        {
          group.people.map((person, key) => {
            return (
              <Link to={'/person/' + person.id} key={key} className="movie-person movie-person_details">
                <div className="movie-person__photo">
                  {person.photo
                    ? <LazyLoad>
                      <div
                        style={{backgroundImage: `url(${person.photo})`}}
                        className="movie-person__photo-inn"
                      >
                        <img
                          src={person.photo}
                          alt={person.name || person.original_name}
                        />
                      </div>
                    </LazyLoad>
                    : ''
                  }
                </div>

                {person.name
                  ? <div className="movie-person__name">{person.name}</div>
                  : ''
                }

                {person.original_name
                  ? <div className="movie-person__original-name">{person.original_name}</div>
                  : ''
                }

                {person.description
                  ? <div
                    className="movie-person__descr"
                  >{person.description}</div>
                  : ''
                }
              </Link>
            );
          })
        }
      </div>
    </div>);
  }

  render() {
    const {response} = this.props;

    if (!response || !response.success) {
      return false;
    }

    const movie = Object.assign({}, response.movie);

    movie.date = movie.release_date || movie.first_air_date;
    movie.descr = movie.tmdb_overview || movie.kp_overview;

    const title = movie.title +
      (moment(movie.date).isValid() ? ' (' + moment(movie.date).format('YYYY') + ')' : '') +
      ' — FlickTips';

    return (
      <div className="content movie">
        <Helmet>
          <title>{title}</title>
          <meta name="description" content={movie.descr} />
        </Helmet>

        <div className="movie__head">
          <div className="movie__head-left">
            <div className="movie-cover movie__cover">
              {movie.tmdb_poster_path
                ? <div
                  style={{backgroundImage: `url(${config.tmdb.posterPath185 + movie.tmdb_poster_path})`}}
                  className="movie-cover-inn"
                >
                  <img src={config.tmdb.posterPath185 + movie.tmdb_poster_path}
                    alt={movie.title}
                  />
                </div>
                : ''
              }
              <MovieBookmark id={movie.id} inBookmarks={movie.inBookmarks} />
            </div>

            <MovieStatExternal
              kpValue={movie.kp_rating_value}
              imdbValue={movie.imdb_rating_value}
              additionClass="m-details"
            />

            <div className="movie__votes">
              <MovieStat {...movie} />
            </div>
          </div>

          <div className="movie__head-data">
            {movie.title
              ? <div
                className="movie__head-row"
              >
                <h1 className="movie-title" title={movie.title}>
                  {movie.title}{movie.type === 'tv' ? ' (сериал)' : ''}
                </h1>
              </div>
              : ''
            }

            {movie.original_title || movie.date
              ? <div
                className="movie__head-row"
              >
                <div className="movie-ot-y">
                  {movie.original_title
                    ? <div className="movie-ot">{movie.original_title}</div>
                    : ''
                  }

                  {movie.date && moment(movie.date).isValid()
                    ? <div className="movie-y">{moment(movie.date).format('YYYY') + 'г'}</div>
                    : ''
                  }
                </div>
              </div>
              : ''
            }

            {movie.genres && movie.genres.length
              ? <div
                className="movie__head-row"
              >
                <div className="movie-genres">{movie.genres.map(g => g.name).join(', ')}</div>
              </div>
              : ''
            }

            {(movie.countries && movie.countries.length) || movie.kp_duration
              ? <div
                className="movie__head-row movie-c-d"
              >
                {movie.countries.length
                  ? <span className="movie-countries">{movie.countries.map(c => c.name).join(', ')}</span>
                  : ''
                }
                {movie.kp_duration
                  ? <span
                    className="movie-duration"
                  >
                    {moment.duration(+movie.kp_duration, 'minutes').format('HH:mm')}
                    {+movie.kp_duration < 60 ? ' мин.' : ''}
                  </span>
                  : ''
                }
              </div>
              : ''
            }
          </div>
        </div>


        {movie.descr
          ? <div
            onClick={this.handleToggleDesc}
            className={'movie__descr' + (this.state.openedDesc ? ' m-open' : '')}
          >
            {movie.descr}
          </div>
          : ''
        }

        {movie.staff && movie.staff.length
          ? movie.staff.map((group, key) => this.renderStaffGroup(group, key))
          : ''
        }
      </div>
    );
  }
}

MoviePage.propTypes = propTypes;

function mapStateToProps(state) {
  const {pending, response} = state.movie.toJS();
  const loaded = state.reduxAsyncConnect.loadState.movie && state.reduxAsyncConnect.loadState.movie.loaded;

  return {pending, loaded, response};
}

export default MoviePage;