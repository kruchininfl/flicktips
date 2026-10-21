import React, {Component} from 'react';
import PropTypes from 'prop-types';
import VoteIcon from 'components/Gui/VoteIcon';
import {Link} from 'react-router';
import moment from 'moment';
import 'moment/locale/ru';

import './MovieVotes.scss';

const propTypes = {
  votes    : PropTypes.array,
  className: PropTypes.any,
  limit    : PropTypes.number,
  filter   : PropTypes.number // 0 - hidden, 1 - all users, 2 - only friends
};

const defaultProps = {
  filter: 1,
  limit : 3
};

// Latest voters as userpics with their vote; the card puts them over the poster, the movie page lists them with names
class MovieVotes extends Component {
  static renderItem(item, key) {
    const {user_avatar: userAvatar, user_name: userName, user_id: userId, value, timestamp} = item;
    const time = moment(timestamp * 1000)
      .from((global ? new Date().getTime() : window.SERVER_TIMESTAMP));

    return (
      <Link to={'/user/' + userId} title={userName + ', ' + time} className="movie-user-votes__item" key={key}>
        <span className="movie-user-votes__item-photo userpic">
          <span style={{backgroundImage: (userAvatar ? `url(${userAvatar})` : null)}} />
          <i className="movie-user-votes__item-vote"><VoteIcon vote={value} active /></i>
        </span>
        <span className="movie-user-votes__item-name">{(userName || '').split(' ')[0]}</span>
      </Link>
    );
  }

  render() {
    const {votes, className, filter, limit} = this.props;

    if (filter === 0 || !votes || !votes.length) {
      return false;
    }

    const rest = votes.length - limit;
    // the API doesn't sort a feed movie's votes, and these are meant to be the latest voters
    const latest = votes.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return (
      <div className={'movie-user-votes ' + (className || '')}>
        {latest.slice(0, limit).map((v, key) => MovieVotes.renderItem(v, key))}
        {rest > 0 ? <span className="movie-user-votes__more">+{rest}</span> : null}
      </div>
    );
  }
}

MovieVotes.propTypes = propTypes;
MovieVotes.defaultProps = defaultProps;

export default MovieVotes;