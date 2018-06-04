import React from 'react';
import PropTypes from 'prop-types';
import {asyncConnect}  from 'redux-connect';
import {Link} from 'react-router';
import {getUserFriends, loadFriends, toggleSubscribe} from 'redux/actions/profileFriendsActions';
import {getUserModel} from '../../redux/models/user';
import ProfileLayout from './ProfileLayout';
import Button from '../Gui/Button';
import {browserHistory} from 'react-router';
import InviteButton from '../../partitions/VkApp/InviteButton';

const propTypes = {
  dispatch: PropTypes.func,
  pending : PropTypes.bool,
  loaded  : PropTypes.bool,
  loading : PropTypes.bool,
  response: PropTypes.any
};

@asyncConnect([
  {
    key    : 'userFriends',
    promise: ({store}) => {
      return store.dispatch(getUserFriends());
    }
  }
], mapStateToProps)

class ProfileFriendsPage extends ProfileLayout {
  constructor(props) {
    super(props);

    this.renderFriends = this.renderFriends.bind(this);
    this.handleLoadData = this.handleLoadData.bind(this);
    this.handleToggleSubscribe = this.handleToggleSubscribe.bind(this);
  }

  componentDidMount() {
    if (this.props.loaded) {
      return false;
    }

    this.props.dispatch(getUserFriends());
  }

  handleLoadData() {
    const {response, loading} = this.props;

    if (loading) {
      return false;
    }

    this.props.dispatch(loadFriends(response.page + 1));
  }

  handleToggleSubscribe(friendsId) {
    this.props.dispatch(toggleSubscribe(friendsId));
  }

  renderFriends(response) {
    return response.entities.map((friend, key) => {
      const isSubscribed = friend.subscribed === '1';
      const loading = typeof friend.loading !== 'undefined' && friend.loading;

      return (
        <div className="friend" key={key}>
          <Link className="link" to={'/user/' + friend.id}>
            <div className="userpic userpic_size_big friend__pic">
              <span style={{backgroundImage: (friend.avatar ? `url(${friend.avatar})` : null)}} />
            </div>

            <div className="friend__name">{friend.username}</div>
          </Link>

          <div className="friend__button">
            <Button
              loading={loading}
              color={isSubscribed ? 'light-gray' : 'green'}
              onClick={() => this.handleToggleSubscribe(friend.id)}
            >
              {isSubscribed ? 'отписаться' : 'подписаться'}
            </Button>
          </div>
        </div>
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
            <div className="page-ph__icn"><img className="icn-forever-alone" src="/public/img/forever-alone.svg" alt="" /></div>
            <div className="page-ph__text">У вас пока нет друзей</div>
            <InviteButton />
          </div>
        </div>
      );
    }

    return (
      <div className="profile">
        {super.render()}

        <div className="profile__friends">
          {this.renderFriends(response)}
        </div>

        {response.total && response.pages > response.page ?
          <Button onClick={this.handleLoadData} loading={loading} additionClass="btn_more">Показать еще</Button>
          : ''
        }

        <InviteButton />
      </div>
    );
  }
}

ProfileFriendsPage.propTypes = propTypes;

function mapStateToProps(state) {
  const {pending, response, loading} = state.userFriends.toJS();
  const loaded = state.reduxAsyncConnect.loadState.userFriends && state.reduxAsyncConnect.loadState.userFriends.loaded;
  const user = getUserModel(state) ? getUserModel(state).toJS() : undefined;

  return {pending, loaded, response, loading, user};
}

export default ProfileFriendsPage;