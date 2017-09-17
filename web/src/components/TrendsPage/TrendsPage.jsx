import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {asyncConnect}  from 'redux-connect';
import {getTrends, addTrends} from 'redux/actions/trendsActions';
import Button from '../Gui/Button';
import MoviePreview from '../../partitions/MoviePreview/MoviePreview';
import {isUserSignedIn} from '../../redux/models/user';
import {openSignInPopup} from '../../redux/actions/appActions';

const propTypes = {
  dispatch    : PropTypes.func,
  pending     : PropTypes.bool,
  loaded      : PropTypes.bool,
  loading     : PropTypes.bool,
  userSignedIn: PropTypes.bool,
  response    : PropTypes.any
};

@asyncConnect([
  {
    key    : 'trends',
    promise: ({store}) => {
      return store.dispatch(getTrends());
    }
  }
], mapStateToProps)

class TrendsPage extends Component {
  constructor(props) {
    super(props);

    this.handleLoadData = this.handleLoadData.bind(this);
    this.handleSignIn = this.handleSignIn.bind(this);
  }

  componentDidMount() {
    window.scrollTo(0, 0);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.userSignedIn !== nextProps.userSignedIn) {
      this.props.dispatch(getTrends());
    }
  }

  handleLoadData() {
    const {response, loading} = this.props;

    if (loading) {
      return false;
    }

    this.props.dispatch(addTrends(response.results.page + 1));
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

  render() {
    const {response, loading, userSignedIn} = this.props;


    return (
      <div className="home-page">
        {!userSignedIn
          ? <div
            className="about-ttip"
          >
            <div className="about-ttip__inn">
              <div className="about-ttip__title">ЛЮБИШЬ ХОРОШЕЕ КИНО?</div>
              <div className="about-ttip__icons">
                <i className="about-ttip__icon icn icn_friends" />
                <i className="about-ttip__icon icn icn_heart-like-fill" />
                <i className="about-ttip__icon icn icn_film" />
              </div>
              <div className="about-ttip__text">Смотри и оценивай фильмы.<br />
                Следи за оценками друзей.</div>
              <Button onClick={this.handleSignIn} additionClass="about-ttip__btn" color="blue">Присоединиться</Button>
            </div>
          </div>
          : ''
        }
        <h1 className="title">Популярные фильмы</h1>

        <div className="movie-prev-list">
          {response && response.results && response.results.total
            ? this.renderMovies(response.results.entities)
            : ''
          }

          {response && response.results && response.results.total && response.results.pages > response.results.page ?
            <Button onClick={this.handleLoadData} loading={loading} additionClass="btn_more">Показать еще</Button>
            : ''
          }
        </div>
      </div>
    );
  }
}

TrendsPage.propTypes = propTypes;

function mapStateToProps(state) {
  const {pending, loading, response} = state.trends.toJS();
  const userSignedIn = isUserSignedIn(state);
  const loaded = state.reduxAsyncConnect.loadState.trends && state.reduxAsyncConnect.loadState.trends.loaded;

  return {pending, loading, loaded, response, userSignedIn};
}

export default TrendsPage;