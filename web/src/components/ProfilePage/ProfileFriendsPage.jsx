import React from 'react';
import PropTypes from 'prop-types';
import {asyncConnect}  from 'redux-connect';
import {getUserFriends, loadFriends, openFindFriends} from 'redux/actions/profileFriendsActions';
import {getUserModel} from '../../redux/models/user';
import ProfileLayout from './ProfileLayout';
import Button from '../Gui/Button';
import {browserHistory, Link} from 'react-router';
import InviteButton from '../../partitions/InviteButton/InviteButton';
import UserSearch from 'partitions/UserSearch';
import FriendsList from 'partitions/FriendsList';
import Spinner from 'components/Gui/Spinner';

const propTypes = {
  dispatch: PropTypes.func,
  pending : PropTypes.bool,
  loaded  : PropTypes.bool,
  loading : PropTypes.bool,
  listType: PropTypes.string,
  location: PropTypes.object,
  response: PropTypes.any,
  recommendations: PropTypes.object
};

const tabs = [
  {type: 'following', title: 'Подписки'},
  {type: 'followers', title: 'Подписчики'},
  {type: 'find', title: 'Найти друзей'}
];

const FRIENDS_URL = '/profile/friends/';

// the tab lives in the URL (?tab=followers / ?tab=find) so it survives reloads and can be linked to
function loadTab(dispatch, location) {
  const tab = location && location.query ? location.query.tab : null;

  if (tab === 'find') {
    return dispatch(openFindFriends());
  }

  return dispatch(getUserFriends(tab === 'followers' ? 'followers' : 'following'));
}

function getTabUrl(type) {
  return type === 'following' ? FRIENDS_URL : FRIENDS_URL + '?tab=' + type;
}

const emptyTexts = {
  following: 'Вы пока ни на кого не подписаны',
  followers: 'На вас пока никто не подписан'
};

@asyncConnect([
  {
    key    : 'userFriends',
    promise: ({store, location}) => loadTab(store.dispatch, location)
  }
], mapStateToProps)

class ProfileFriendsPage extends ProfileLayout {
  constructor(props) {
    super(props);

    this.handleLoadData = this.handleLoadData.bind(this);
  }

  componentDidMount() {
    if (this.props.loaded) {
      return false;
    }

    loadTab(this.props.dispatch, this.props.location);
  }

  handleLoadData() {
    const {response, loading} = this.props;

    if (loading) {
      return false;
    }

    this.props.dispatch(loadFriends(response.page + 1));
  }


  renderTabs() {
    const {listType} = this.props;

    return (
      <div className="profile__tabs">
        {tabs.map((tab) => (
          <Link
            key={tab.type}
            to={getTabUrl(tab.type)}
            className={'profile__tab' + (tab.type === listType ? ' m-active' : '')}
          >
            {tab.title}
          </Link>
        ))}
      </div>
    );
  }

  renderList() {
    const {response, loading, pending, listType} = this.props;

    if (pending) {
      return false;
    }

    if (!response.total) {
      return (
        <div className="page-ph">
          <div className="page-ph__icn"><img className="icn-forever-alone" src="/public/img/forever-alone.svg" alt="" /></div>
          <div className="page-ph__text">
            {emptyTexts[listType]}.<br />
            <Link className="link" to={getTabUrl('find')}>Найти друзей</Link>
            {listType === 'following' ? <span> или <InviteButton linkText="пригласить друзей" /></span> : ''}
          </div>
        </div>
      );
    }

    return (
      <div>
        <FriendsList users={response.entities} />

        {response.pages > response.page ?
          <Button onClick={this.handleLoadData} loading={loading} additionClass="btn_more">Показать еще</Button>
          : ''
        }
      </div>
    );
  }

  renderFind() {
    const {items, pending} = this.props.recommendations;

    return (
      <div>
        <UserSearch />

        <div className="profile__section-title">Рекомендации</div>
        {pending && !items.length ? <div className="profile__section-empty"><Spinner active /></div> : ''}
        {!pending && !items.length
          ? <div className="profile__section-empty">Пока некого порекомендовать</div>
          : <FriendsList users={items} />
        }
      </div>
    );
  }

  render() {
    const {response, user, listType} = this.props;

    if (!user) {
      setTimeout(() => browserHistory.push('/signin'));
      return false;
    }

    if (listType !== 'find' && !response) {
      return false;
    }

    return (
      <div className="profile">
        {super.render()}

        {this.renderTabs()}
        {listType === 'find' ? this.renderFind() : this.renderList()}
      </div>
    );
  }
}

ProfileFriendsPage.propTypes = propTypes;

function mapStateToProps(state) {
  const {pending, response, loading, listType, recommendations} = state.userFriends.toJS();
  const loaded = state.reduxAsyncConnect.loadState.userFriends && state.reduxAsyncConnect.loadState.userFriends.loaded;
  const user = getUserModel(state) ? getUserModel(state).toJS() : undefined;

  return {pending, loaded, response, loading, listType, recommendations, user};
}

export default ProfileFriendsPage;