import React, {Component} from 'react';
import PropTypes from 'prop-types';
import './LastGradedPage.scss';
import {asyncConnect} from 'redux-connect';
import {addLastGraded, getLastGraded} from 'redux/actions/lastGradedActions';
import Button from '../Gui/Button';
import MoviePreview from '../../partitions/MoviePreview/MoviePreview';
import MovieHero from '../../partitions/MovieHero';
import {getUserModel, isUserSignedIn} from '../../redux/models/user';
import InviteButton from '../../partitions/InviteButton/InviteButton';

const propTypes = {
  dispatch: PropTypes.func,
  pending: PropTypes.bool,
  loaded: PropTypes.bool,
  loading: PropTypes.bool,
  userSignedIn: PropTypes.bool,
  user: PropTypes.object,
  response: PropTypes.any,
  onlyFriends: PropTypes.bool
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

    this.renderEmptyPage = this.renderEmptyPage.bind(this);
    this.handleLoadData = this.handleLoadData.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
  }

  componentDidMount() {
    window.scrollTo(0, 0);
  }

  componentWillReceiveProps(nextProps) {
    if (
      this.props.userSignedIn !== nextProps.userSignedIn
      || (this.props.user && this.props.user.hide_viewed !== nextProps.user.hide_viewed)
    ) {
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

  renderMovies(entities) {
    return entities.map((entity, key) => {
      return (
        <MoviePreview key={key} movie={entity} />
      );
    });
  }

  renderEmptyPage() {
    const {onlyFriends} = this.props;

    if (onlyFriends) {
      return (
        <div className="page-ph">
          <div className="page-ph__icn"><i className="icn icn_list" /></div>
          <div className="page-ph__text">
            К сожалению, ваши друзья пока не оценивали фильмы и сериалы. <br /><br />
            Расскажите друзьям о нашем приложении, чтобы знать какие фильмы им понравились.
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

    const entities = response.results.entities || [];
    const [first, ...rest] = entities;

    return (
      <div className="home-page">
        <div className="lg-header">
          <div className="segmented">
            <span
              onClick={() => this.handleFilter(true)}
              className={'segmented__item' + (onlyFriends ? ' m-active' : '')}
            >Друзья</span>
            <span
              onClick={() => this.handleFilter(false)}
              className={'segmented__item' + (onlyFriends ? '' : ' m-active')}
            >Все оценки</span>
          </div>
        </div>

        {first ? <MovieHero movie={first} label={onlyFriends ? 'Свежая оценка друзей' : 'Свежая оценка'} /> : null}

        {first
          ? <div className="lg-list movie-prev-list">{this.renderMovies(rest)}</div>
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
  return {pending, loading, loaded, response, user, userSignedIn, onlyFriends};
}

export default LastGradedPage;