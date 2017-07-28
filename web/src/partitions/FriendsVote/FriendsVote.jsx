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
  dispatch : PropTypes.func.isRequired,
  vote     : PropTypes.number.isRequired,
  timestamp: PropTypes.number.isRequired,
  movie    : PropTypes.any.isRequired,
  user     : PropTypes.any.isRequired
};

class FriendsVote extends Component {
  constructor(props) {
    super(props);

    this.handleToggleMovieVisibility = this.handleToggleMovieVisibility.bind(this);
    this.handleSendVote = this.handleSendVote.bind(this);

    this.state = {
      openedMovie: false
    };
  }

  handleToggleMovieVisibility() {
    this.setState({openedMovie: !this.state.openedMovie});
  }

  handleSendVote(entityId, vote) {
    this.props.dispatch(voteRequest(entityId, vote));
  }

  render() {
    const {vote, timestamp, movie, user} = this.props;
    const {openedMovie} = this.state;

    return (
      <div className="friend-vote">
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

        <div className={'friend-vote__movie' + (openedMovie ? ' m-active' : '')}>
          <MoviePreview
            id={movie.id}
            image={movie.tmdb_poster_path}
            title={movie.title}
            originalTitle={movie.original_title}
            genres={movie.genres ? movie.genres.map((el) => el.name) : []}
            date={movie.release_date || movie.first_air_date}
            likes={movie.likes}
            dislikes={movie.dislikes}
            neutral={movie.neutral}
            isLiked={movie.isLiked}
            isDisliked={movie.isDisliked}
            isNeutral={movie.isNeutral}
            inBookmarks={movie.inBookmarks}
          />
          <div className="friend-vote__movie-toggle" onClick={this.handleToggleMovieVisibility} />
        </div>
      </div>
    );
  }
}

FriendsVote.propTypes = propTypes;

export default connect()(FriendsVote);