import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {asyncConnect}  from 'redux-connect';
import {getFriendsVotes, loadVotes, resetFeed} from 'redux/actions/feedActions';
import FriendsVote from 'partitions/FriendsVote/FriendsVote';

import './HomePage.scss';
import Button from '../Gui/Button';
import {isUserSignedIn} from '../../redux/models/user';
import SignInPage from '../SignInPage/SignInPage';
import InviteButton from '../../partitions/VkApp/InviteButton';

const propTypes = {
  dispatch    : PropTypes.func,
  pending     : PropTypes.bool,
  loaded      : PropTypes.bool,
  loading     : PropTypes.bool,
  response    : PropTypes.any,
  userSignedIn: PropTypes.bool
};

@asyncConnect([
  {
    key    : 'feed',
    promise: ({store}) => {
      return store.dispatch(getFriendsVotes());
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

    this.props.dispatch(getFriendsVotes());
  }

  componentWillReceiveProps(nextProps) {
    if (!this.props.userSignedIn && nextProps.userSignedIn) {
      this.props.dispatch(getFriendsVotes());
    }

    if (this.props.userSignedIn && !nextProps.userSignedIn) {
      this.props.dispatch(resetFeed());
    }
  }

  componentWillUnmount() {
    this.props.dispatch(resetFeed());
  }

  handleLoadData() {
    const {response, loading} = this.props;

    if (loading) {
      return false;
    }

    this.props.dispatch(loadVotes(response.results.page + 1));
  }

  static renderVotes(entities) {
    return entities.map((entity, key) => {
      return (
        <FriendsVote key={key} {...entity} />
      );
    });
  }

  static renderEmptyPage(userSignedIn) {
    if (userSignedIn) {
      return (<div className="page-ph">
        <div className="page-ph__icn"><i className="icn icn_list"/></div>
        <div className="page-ph__text">Ваша лента пока пуста</div>
        <InviteButton />
      </div>);
    }

    return <SignInPage />;
  }

  render() {
    const {response, loading, userSignedIn} = this.props;

    return (
      <div className="feed">
        {response && response.results && response.results.total
          ? HomePage.renderVotes(response.results.entities)
          : HomePage.renderEmptyPage(userSignedIn)
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
  const {pending, loading, response} = state.feed.toJS();
  const loaded = state.reduxAsyncConnect.loadState.feed && state.reduxAsyncConnect.loadState.feed.loaded;
  const userSignedIn = isUserSignedIn(state);

  return {pending, loading, loaded, response, userSignedIn};
}

export default HomePage;