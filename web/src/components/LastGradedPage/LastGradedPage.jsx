import React, {Component, createRef} from 'react';
import PropTypes from 'prop-types';
import './LastGradedPage.scss';
import {asyncConnect} from 'redux-connect';
import {addLastGraded, getLastGraded} from 'redux/actions/lastGradedActions';
import Button from '../Gui/Button';
import MoviePreview from '../../partitions/MoviePreview/MoviePreview';
import {getUserModel, isUserSignedIn} from '../../redux/models/user';
import InviteButton from '../../partitions/VkApp/InviteButton';

const propTypes = {
  dispatch: PropTypes.func,
  pending: PropTypes.bool,
  loaded: PropTypes.bool,
  loading: PropTypes.bool,
  userSignedIn: PropTypes.bool,
  user: PropTypes.object,
  response: PropTypes.any,
  onlyFriends: PropTypes.bool,
  isVkApp: PropTypes.bool
};

@asyncConnect([
  {
    key: 'lastGraded',
    promise: ({store}) => {
      const state = store.getState();
      const userSignedIn = isUserSignedIn(state);
      const loaded = state.reduxAsyncConnect.loadState.lastGraded && state.reduxAsyncConnect.loadState.lastGraded.loaded;

      const page = 1;
      const onlyFriends = state.lastGraded.get('onlyFriends') !== null
        ? state.lastGraded.get('onlyFriends')
        : (userSignedIn && !loaded);

      return store.dispatch(getLastGraded(page, onlyFriends));
    }
  }
], mapStateToProps)

class LastGradedPage extends Component {
  constructor(props) {
    super(props);

    this.ref = createRef();

    this.renderEmptyPage = this.renderEmptyPage.bind(this);
    this.handleLoadData = this.handleLoadData.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  componentDidMount() {
    window.scrollTo(0, 0);
    window.addEventListener('resize', this.handleResize);
    this.handleResize(true);
  }

  componentWillReceiveProps(nextProps) {
    if (
      this.props.userSignedIn !== nextProps.userSignedIn
      || (this.props.user && this.props.user.hide_viewed !== nextProps.user.hide_viewed)
    ) {
      this.props.dispatch(getLastGraded(1, nextProps.userSignedIn));
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  }

  handleResize(first) {
    const windowWidth = document.documentElement.clientWidth;
    const minTileWidth = 270;
    const actualTileWidthPercents = (100 / Math.floor(windowWidth / minTileWidth)) + '%';

    const style = this.ref.current.style;

    if (first === true) {
      style.setProperty('--tile-transition', 'none');
      setTimeout(() => style.setProperty('--tile-transition', 'all'), 10);
    }

    style.setProperty('--tile-width', actualTileWidthPercents);
  }

  handleLoadData() {
    const {response, loading, onlyFriends} = this.props;

    if (loading) {
      return false;
    }

    this.props.dispatch(addLastGraded(response.results.page + 1, onlyFriends));
  }

  handleFilter(onlyFriends) {
    if (this.props.onlyFriends === onlyFriends) {
      return false;
    }

    this.props.dispatch(getLastGraded(1, onlyFriends));
  }

  renderMovies(entities) {
    return entities.map((entity, key) => {
      return (
        <MoviePreview key={key} movie={entity} />
      );
    });
  }

  renderEmptyPage() {
    const {onlyFriends, isVkApp} = this.props;

    if (onlyFriends) {
      return (
        <div className="page-ph">
          <div className="page-ph__icn"><i className="icn icn_list" /></div>
          <div className="page-ph__text">
            К сожалению, ваши друзья пока не оценивали фильмы и сериалы. <br /><br />
            {isVkApp
              ? 'Пригласите друзей, чтобы знать какие фильмы им понравились.'
              : 'Расскажите друзьям о нашем приложение, чтобы знать какие фильмы им понравились.'
            }
          </div>
          <br />
          <InviteButton />
        </div>
      );
    }

    return (
      <div className="page-ph">
        <div className="page-ph__icn"><i className="icn icn_list" /></div>
        <div className="page-ph__text">К сожалению, на данный момент нет оценок</div>
      </div>
    );
  }

  render() {
    const {response, onlyFriends, loading} = this.props;

    // return this.renderEmptyPage();

    return (
      <div className="home-page" ref={this.ref}>
        <div className="lg-header">
          <span
            onClick={() => this.handleFilter(false)}
            className={'lg-toggle-btn' + (onlyFriends ? '' : ' m-active')}
          >все оценки</span>
          <span
            onClick={() => this.handleFilter(true)}
            className={'lg-toggle-btn' + (!onlyFriends ? '' : ' m-active')}
          >оценки друзей</span>
        </div>

        {response.results.entities && response.results.entities.length
          ? <div
            className="lg-list movie-prev-list"
          >
            {this.renderMovies(response.results.entities)}
          </div>
          : this.renderEmptyPage()
        }

        {response.results.page < response.results.pages
          ? <Button onClick={this.handleLoadData} loading={loading} additionClass="btn_more">Показать еще</Button>
          : ''
        }
      </div>
    );
  }
}

LastGradedPage.propTypes = propTypes;

function mapStateToProps(state) {
  const {pending, loading, response, onlyFriends} = state.lastGraded.toJS();
  const userSignedIn = isUserSignedIn(state);
  const user = userSignedIn && getUserModel(state).toJS();
  const loaded = state.reduxAsyncConnect.loadState.lastGraded && state.reduxAsyncConnect.loadState.lastGraded.loaded;
  const isVkApp = state.app.get('isVkApp');

  return {pending, loading, loaded, response, user, userSignedIn, onlyFriends, isVkApp};
}

export default LastGradedPage;