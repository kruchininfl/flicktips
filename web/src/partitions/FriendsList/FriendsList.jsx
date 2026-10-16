import React from 'react';
import PropTypes from 'prop-types';
import {Link} from 'react-router';
import SubscribeButton from 'partitions/SubscribeButton';

const propTypes = {
  users: PropTypes.array.isRequired
};

// why a recommended user is suggested (see UserRepository::getRecommendations)
function getReasonText(user) {
  if (user.reason === 'friends') {
    return 'Общие друзья: ' + user.reason_count;
  }

  if (user.reason === 'votes') {
    return 'Похожие оценки: ' + user.reason_count;
  }

  return '';
}

// Grid of users with a follow button each (friends page tabs, people search, recommendations)
export default function FriendsList({users}) {
  return (
    <div className="profile__friends">
      {users.map((user) => (
        <div className="friend" key={user.id}>
          <Link className="link" to={'/user/' + user.id}>
            <div className="userpic userpic_size_big friend__pic">
              <span style={{backgroundImage: (user.avatar ? `url(${user.avatar})` : null)}} />
            </div>

            <div className="friend__name">{user.username}</div>
          </Link>

          {getReasonText(user) ? <div className="friend__reason">{getReasonText(user)}</div> : ''}

          <div className="friend__button">
            <SubscribeButton userId={user.id} subscribed={!!user.subscribed} />
          </div>
        </div>
      ))}
    </div>
  );
}

FriendsList.propTypes = propTypes;