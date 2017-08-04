import React, {Component} from 'react';
import PropTypes from 'prop-types';
import './HomePage.scss';
import {asyncConnect}  from 'redux-connect';
import {getTrends, addTrends} from 'redux/actions/trendsActions';
import Button from '../Gui/Button';
import MoviePreview from '../../partitions/MoviePreview/MoviePreview';

const propTypes = {
  dispatch: PropTypes.func,
  pending : PropTypes.bool,
  loaded  : PropTypes.bool,
  loading : PropTypes.bool,
  response: PropTypes.any
};

@asyncConnect([
  {
    key    : 'trends',
    promise: ({store}) => {
      return store.dispatch(getTrends());
    }
  }
], mapStateToProps)

class HomePage extends Component {
  constructor(props) {
    super(props);

    this.handleLoadData = this.handleLoadData.bind(this);
  }

  componentDidMount() {
    window.scrollTo(0, 0);

    if (this.props.loaded) {
      return false;
    }

    this.props.dispatch(getTrends());
  }

  handleLoadData() {
    const {response, loading} = this.props;

    if (loading) {
      return false;
    }

    this.props.dispatch(addTrends(response.results.page + 1));
  }

  renderMovies(entities) {
    return entities.map((entity, key) => {
      return (
        <MoviePreview key={key}
          dispatch={this.props.dispatch}
          id={entity.id}
          vote={entity.vote}
          image={entity.tmdb_poster_path}
          title={entity.title}
          originalTitle={entity.original_title}
          genres={entity.genres ? entity.genres.map((el) => el.name) : []}
          date={entity.release_date || entity.first_air_date}
          likes={entity.likes}
          dislikes={entity.dislikes}
          neutral={entity.neutral}
          isLiked={entity.isLiked}
          isDisliked={entity.isDisliked}
          isNeutral={entity.isNeutral}
          inBookmarks={entity.inBookmarks}
        />
      );
    });
  }

  render() {
    const {response, loading} = this.props;

    return (
      <div className="trends">
        <h1 className="title">Популярные фильмы</h1>

        {response && response.results && response.results.total
          ? this.renderMovies(response.results.entities)
          : ''
        }

        {response && response.results && response.results.total && response.results.pages > response.results.page ?
          <Button onClick={this.handleLoadData} loading={loading} additionClass="btn_more">Показать еще</Button>
          : ''
        }
      </div>
    );
  }
}

HomePage.propTypes = propTypes;

function mapStateToProps(state) {
  const {pending, loading, response} = state.trends.toJS();
  const loaded = state.reduxAsyncConnect.loadState.trends && state.reduxAsyncConnect.loadState.trends.loaded;

  return {pending, loading, loaded, response};
}

export default HomePage;