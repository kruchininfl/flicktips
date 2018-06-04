import React, {Component} from 'react';
import PropTypes from 'prop-types';
import './PersonPage.scss';
import {asyncConnect}  from 'redux-connect';
import {getPerson} from 'redux/actions/personActions';
import {Helmet} from 'react-helmet';
import MoviePreview from '../../partitions/MoviePreview/MoviePreview';

const propTypes = {
  dispatch: PropTypes.func,
  pending : PropTypes.bool,
  loaded  : PropTypes.bool,
  response: PropTypes.any
};

@asyncConnect([
  {
    key    : 'person',
    promise: ({params, store}) => {
      return store.dispatch(getPerson(params && params.id ? params.id : null));
    }
  }
], mapStateToProps)

class PersonPage extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    window.scrollTo(0, 0);
  }

  render() {
    const {response} = this.props;

    if (!response || !response.success) {
      return false;
    }

    const person = Object.assign({}, response.person);

    if (person.name === person.original_name) {
      person.original_name = null;
    }

    let metaName;

    if (person.name) {
      metaName = person.name + (person.original_name ? ' (' + person.original_name + ')' : '');
    } else {
      metaName = person.original_name;
    }

    const title = metaName + ' — Фильмы — FlickTips';
    const descr = metaName + '. Фильмография, фото, возраст. Список фильмов.';

    const career = [];

    const moviesMap = new Map();

    person.movies.forEach((movie) => {
      if (moviesMap.has(movie.group_id)) {
        moviesMap.get(movie.group_id).movies.push(movie);
      } else {
        career.push(movie.group_title);
        moviesMap.set(movie.group_id, {type: movie.group_title, movies: [movie]});
      }
    });

    const groupedMovies = new Map([...moviesMap.entries()].sort());

    return (
      <div className="person">
        <Helmet>
          <title>{title}</title>
          <meta name="description" content={descr} />
        </Helmet>

        <div className="person__head">
          <div className="person__head-photo-wrap">
            <div className="person__head-photo">
              {person.kp_photo
                ? <div
                  style={{backgroundImage: `url(${person.kp_photo})`}}
                  className="person__head-photo-inn"
                >
                  <img src={person.kp_photo}
                    alt={person.metaName}
                  />
                </div>
                : ''
              }
            </div>
          </div>

          <div className="person__head-data">
            {person.name
              ? <h1 className="person__title">{person.name}</h1>
              : ''
            }

            {person.name
              ? <h2 className="person__subtitle">{person.original_name}</h2>
              : <h1 className="person__title">{person.original_name}</h1>
            }

            {career.length
              ? <dl className="person__dl"><dt>Карьера</dt><dd>{career.join(', ')}</dd></dl>
              : ''
            }
          </div>
        </div>

        {groupedMovies.size
          ? Array.from(groupedMovies.values()).map((group, key) => {
            return (<div
              key={key}
              className="person__group"
            >
              <div className="person__group-title">{group.type}</div>
              <div className="person__group-list movie-prev-list">
                {group.movies.map((movie, keyMovie) => <MoviePreview key={keyMovie} movie={movie} />)}
              </div>
            </div>);
          })
          : ''
        }
      </div>
    );
  }
}

PersonPage.propTypes = propTypes;

function mapStateToProps(state) {
  const {pending, response} = state.person.toJS();
  const loaded = state.reduxAsyncConnect.loadState.person && state.reduxAsyncConnect.loadState.person.loaded;

  return {pending, loaded, response};
}

export default PersonPage;