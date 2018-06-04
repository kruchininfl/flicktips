import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {voteRequest} from 'redux/actions/voteActions';

import './FriendsVote.scss';
import MoviePreview from 'partitions/MoviePreview/MoviePreview';
import {connect} from 'react-redux';
import moment from 'moment';
import 'moment/locale/ru';
import {Link} from 'react-router';
import {getVoteIconClassById} from '../../helpers';

const propTypes = {
  dispatch    : PropTypes.func.isRequired,
  vote        : PropTypes.number.isRequired,
  timestamp   : PropTypes.number.isRequired,
  movie       : PropTypes.any.isRequired,
  user        : PropTypes.any.isRequired,
  isNew       : PropTypes.bool.isRequired,
  closeSidebar: PropTypes.func.isRequired
};

class FriendsVote extends Component {
  constructor(props) {
    super(props);

    this.handleToggleMovieVisibility = this.handleToggleMovieVisibility.bind(this);
    this.handleSendVote = this.handleSendVote.bind(this);
    this.handleClickMovie = this.handleClickMovie.bind(this);

    this.state = {
      openedMovie: false
    };
  }

  handleToggleMovieVisibility(e) {
    e.stopPropagation();
    this.setState({openedMovie: !this.state.openedMovie});
  }

  handleSendVote(entityId, vote) {
    this.props.dispatch(voteRequest(entityId, vote));
  }

  handleClickMovie() {
    this.props.closeSidebar();
  }

  render() {
    const {vote, timestamp, movie, user, isNew} = this.props;
    const {openedMovie} = this.state;

    return (
      <div className={'friend-vote' + (isNew ? ' m-new' : '')}>
        <Link to={'/user/' + user.id} className="friend-vote__main">
          <div className="friend-vote__main-left">
            <div
              onClick={this.handleOpenSearch}
              className="userpic"
            >
              <span style={{backgroundImage: (user.avatar ? `url(${user.avatar})` : null)}} />
            </div>

            <div className="friend-vote__date">
              {moment(timestamp * 1000).format('DD.MM.YY')}
            </div>
          </div>

          <div className="friend-vote__main-text">
            <span className="friend-vote__username link">{user.name}</span>
            <span className="friend-vote__vote"><i className={'icn ' + getVoteIconClassById(vote, true)} /></span>

            <div className="friend-vote__movie-title movie-prev__title">
              {movie.title
                ? <strong>{movie.title}</strong>
                : ''
              }
              {movie.original_title ?
                <span>{movie.title ? ' / ' : ''}{movie.original_title}</span>
                : ''
              }
            </div>
          </div>
        </Link>

        <div onClick={this.handleClickMovie} className={'friend-vote__movie' + (openedMovie ? ' m-active' : '')}>
          <MoviePreview movie={movie} />
          <div className="friend-vote__movie-toggle" onClick={this.handleToggleMovieVisibility} />
        </div>
      </div>
    );
  }
}

FriendsVote.propTypes = propTypes;

export default connect()(FriendsVote);