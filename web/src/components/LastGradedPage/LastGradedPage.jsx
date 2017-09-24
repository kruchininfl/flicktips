import React, {Component} from 'react';
import PropTypes from 'prop-types';
import './LastGradedPage.scss';
import {asyncConnect}  from 'redux-connect';
import {getLastGraded, addLastGraded} from 'redux/actions/lastGradedActions';
import Button from '../Gui/Button';
import MoviePreview from '../../partitions/MoviePreview/MoviePreview';
import {isUserSignedIn} from '../../redux/models/user';
import {openSignInPopup} from '../../redux/actions/appActions';
import InviteButton from '../../partitions/VkApp/InviteButton';

const propTypes = {
  dispatch    : PropTypes.func,
  pending     : PropTypes.bool,
  loaded      : PropTypes.bool,
  loading     : PropTypes.bool,
  userSignedIn: PropTypes.bool,
  response    : PropTypes.any,
  onlyFriends : PropTypes.bool,
  isVkApp     : PropTypes.bool
};

@asyncConnect([
  {
    key    : 'lastGraded',
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

    this.renderEmptyPage = this.renderEmptyPage.bind(this);
    this.renderAdv = this.renderAdv.bind(this);
    this.handleLoadData = this.handleLoadData.bind(this);
    this.handleSignIn = this.handleSignIn.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
  }

  componentDidMount() {
    window.scrollTo(0, 0);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.userSignedIn !== nextProps.userSignedIn) {
      this.props.dispatch(getLastGraded(1, nextProps.userSignedIn));
    }
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

  handleSignIn() {
    this.props.dispatch(openSignInPopup());
  }

  renderMovies(entities) {
    return entities.map((entity, key) => {
      return (
        <MoviePreview key={key} movie={entity} />
      );
    });
  }

  renderAdv() {
    const {userSignedIn} = this.props;

    if (userSignedIn) {
      return false;
    }

    return (
      <div className="about-ttip">
        <div className="about-ttip__inn">
          <div className="about-ttip__title">ЛЮБИШЬ ХОРОШЕЕ КИНО?</div>
          <div className="about-ttip__icons">
            <i className="about-ttip__icon icn icn_friends" />
            <i className="about-ttip__icon icn icn_heart-like-fill" />
            <i className="about-ttip__icon icn icn_film" />
          </div>
          <div className="about-ttip__text">Смотри и оценивай фильмы.<br />
            Следи за оценками друзей.
          </div>
          <Button onClick={this.handleSignIn} additionClass="about-ttip__btn" color="blue">Присоединиться</Button>
        </div>
      </div>
    );
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
      <div className="home-page">
        {this.renderAdv()}
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
  const loaded = state.reduxAsyncConnect.loadState.lastGraded && state.reduxAsyncConnect.loadState.lastGraded.loaded;
  const isVkApp = state.app.get('isVkApp');

  return {pending, loading, loaded, response, userSignedIn, onlyFriends, isVkApp};
}

export default LastGradedPage;