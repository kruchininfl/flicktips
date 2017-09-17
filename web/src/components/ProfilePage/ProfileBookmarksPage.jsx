import React from 'react';
import PropTypes from 'prop-types';
import {asyncConnect}  from 'redux-connect';
import {getBookmarks, loadBookmarks} from 'redux/actions/bookmarkActions';
import MoviePreview from 'partitions/MoviePreview';
import Button from 'components/Gui/Button';
import ProfileLayout from './ProfileLayout';
import {getUserModel} from '../../redux/models/user';
import {browserHistory} from 'react-router';

const propTypes = {
  dispatch: PropTypes.func,
  pending : PropTypes.bool,
  loaded  : PropTypes.bool,
  loading : PropTypes.bool,
  params  : PropTypes.any,
  response: PropTypes.any
};

@asyncConnect([
  {
    key    : 'userBookmarks',
    promise: ({store}) => {
      return store.dispatch(getBookmarks());
    }
  }
], mapStateToProps)

class ProfileBookmarksPage extends ProfileLayout {
  constructor(props) {
    super(props);

    this.handleLoadData = this.handleLoadData.bind(this);
  }

  componentDidMount() {
    if (this.props.loaded) {
      return false;
    }

    this.props.dispatch(getBookmarks());
  }

  handleLoadData() {
    const {response, loading} = this.props;

    if (loading) {
      return false;
    }

    this.props.dispatch(loadBookmarks(response.page + 1));
  }

  renderMovies(response) {
    return response.entities.map((entity, key) => {
      return (
        <MoviePreview
          key={key}
          className={'profile__bookmarks-item' + (entity.inBookmarks ? '' : ' m-inactive')}
          movie={entity}
          votesFilter={0}
        />
      );
    });
  }

  render() {
    const {response, loading, user, pending} = this.props;

    if (pending) {
      return false;
    }

    if (!user || !response) {
      setTimeout(() => browserHistory.push('/signin'));
      return false;
    }

    if (!response.total) {
      return (
        <div className="profile">
          {super.render()}

          <div className="page-ph">
            <div className="page-ph__icn"><i className="icn icn_bookmark-book" /></div>
            <div className="page-ph__text">У вас нет закладок</div>
          </div>
        </div>
      );
    }

    return (
      <div className="profile">
        {super.render()}

        <div className="movie-prev-list">{this.renderMovies(response)}</div>

        {response.total && response.pages > response.page ?
          <Button onClick={this.handleLoadData} loading={loading} additionClass="btn_more">Показать еще</Button>
          : ''
        }
      </div>
    );
  }
}

ProfileBookmarksPage.propTypes = propTypes;

function mapStateToProps(state) {
  const {pending, loading, response} = state.userBookmarks.toJS();
  const loaded = state.reduxAsyncConnect.loadState.userBookmarks && state.reduxAsyncConnect.loadState.userBookmarks.loaded;
  const user = getUserModel(state) ? getUserModel(state).toJS() : undefined;

  return {pending, loaded, loading, response, user};
}

export default ProfileBookmarksPage;