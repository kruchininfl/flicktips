import React, {Component} from 'react';
import PropTypes from 'prop-types';
import './MovieFriendsVotes.scss';
import {connect} from 'react-redux';
import {getVoteIconClassById} from '../../helpers';
import {Link} from 'react-router';
import {isUserSignedIn} from '../../redux/models/user';

const propTypes = {
  dispatch    : PropTypes.func.isRequired,
  votes       : PropTypes.array,
  className   : PropTypes.any,
  userSignedIn: PropTypes.bool
};


class MovieFriendsVotes extends Component {
  constructor(props) {
    super(props);
  }

  static renderItem(item, key) {
    const {user_avatar: userAvatar, user_id: userId, vote} = item;

    return (
      <Link to={'/user/' + userId} key={key} className="movie-friends-votes__item">
        <div
          onClick={this.handleOpenSearch}
          className="movie-friends-votes__item-photo userpic header-profile__photo"
        >
          <span style={{backgroundImage: (userAvatar ? `url(${userAvatar})` : null)}} />
          <i className="movie-friends-votes__item-vote">
            <i className={'icn ' + getVoteIconClassById(vote, true)} />
          </i>
        </div>
      </Link>
    );
  }

  render() {
    const {votes, userSignedIn, className} = this.props;

    if (!userSignedIn) {
      return false;
    }

    if (!votes || !votes.length) {
      return (
        <div className={'movie-friends-votes ' + (className || '')}>
          <div className="movie-friends-votes-ph">Ваши друзья пока не оценивали этот фильм</div>
        </div>
      );
    }

    return (
      <div className={'movie-friends-votes ' + (className || '')}>
        <div className="movie-friends-votes__list">
          {votes.map((v, key) => MovieFriendsVotes.renderItem(v, key))}
        </div>
      </div>
    );
  }
}

MovieFriendsVotes.propTypes = propTypes;

function mapStateToProps(state) {
  const userSignedIn = isUserSignedIn(state);

  return {userSignedIn};
}

export default connect(mapStateToProps)(MovieFriendsVotes);