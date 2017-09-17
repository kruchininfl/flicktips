import React, {Component} from 'react';
import PropTypes from 'prop-types';
import './MovieVotes.scss';
import {connect} from 'react-redux';
import {getVoteIconClassById} from '../../helpers';
import {Link} from 'react-router';
import {isUserSignedIn} from '../../redux/models/user';
import moment from 'moment';
import 'moment/locale/ru';
import CustomScrollbars from 'components/Gui/CustomScrollbars';

const propTypes = {
  dispatch    : PropTypes.func.isRequired,
  votes       : PropTypes.array,
  className   : PropTypes.any,
  userSignedIn: PropTypes.bool,
  filter      : PropTypes.number // 0 - hidden, 1 - all users, 2 - only friends
};

const defaultPropTypes = {
  filter: 1 // 0 - hidden, 1 - all users, 2 - only friends
};

const PLACEHOLDER_TEXT_ALL = 'Наши пользователи пока не оценивали этот фильм';
const PLACEHOLDER_TEXT_FRIENDS = 'Ваши друзья пока не оценивали этот фильм';

class MovieVotes extends Component {
  constructor(props) {
    super(props);
  }

  static renderItem(item, key) {
    const {user_avatar: userAvatar, user_name: userName, user_id: userId, value, timestamp} = item;
    const time = moment(timestamp * 1000)
      .from((global ? new Date().getTime() : window.SERVER_TIMESTAMP));

    return (
      <Link to={'/user/' + userId} key={key} className="movie-user-votes__item">
        <div
          onClick={this.handleOpenSearch}
          className="movie-user-votes__item-photo userpic header-profile__photo"
        >
          <span style={{backgroundImage: (userAvatar ? `url(${userAvatar})` : null)}} />
          <div className="movie-user-votes__item-vote">
            <i className={'icn ' + getVoteIconClassById(value, true)} />
          </div>
        </div>

        <div className="movie-user-votes__item-content">
          <div className="movie-user-votes__item-head">
            <span>{userName}</span>
            <i className={'icn ' + getVoteIconClassById(value, true)} />
          </div>
          <div className="movie-user-votes__item-date">{time}</div>
        </div>
      </Link>
    );
  }

  render() {
    const {votes, className, filter} = this.props;

    if (filter === 0) {
      return false;
    }

    if (!votes || !votes.length) {
      return (
        <div className={'movie-user-votes ' + (className || '')}>
          <div className="movie-user-votes-ph">{filter === 1 ? PLACEHOLDER_TEXT_ALL : PLACEHOLDER_TEXT_FRIENDS}</div>
        </div>
      );
    }

    return (
      <div className={'movie-user-votes ' + (className || '')}>
        <div className="movie-user-votes__list">
          <CustomScrollbars>
            {votes.map((v, key) => MovieVotes.renderItem(v, key))}
          </CustomScrollbars>
        </div>
      </div>
    );
  }
}

MovieVotes.propTypes = propTypes;
MovieVotes.defaultProps = defaultPropTypes;

function mapStateToProps(state) {
  const userSignedIn = isUserSignedIn(state);

  return {userSignedIn};
}

export default connect(mapStateToProps)(MovieVotes);