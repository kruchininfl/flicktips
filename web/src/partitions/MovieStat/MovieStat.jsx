import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {voteRequest} from 'redux/actions/voteActions';

import './MovieStat.scss';
import {connect} from 'react-redux';
import {getVoteIconClassById} from '../../helpers';

const propTypes = {
  dispatch   : PropTypes.func.isRequired,
  id         : PropTypes.number.isRequired,
  super      : PropTypes.number,
  likes      : PropTypes.number,
  dislikes   : PropTypes.number,
  neutral    : PropTypes.number,
  isSuper    : PropTypes.bool,
  isLiked    : PropTypes.bool,
  isDisliked : PropTypes.bool,
  isNeutral  : PropTypes.bool,
  inBookmarks: PropTypes.bool
};

const defaultProps = {
  super      : 0,
  likes      : 0,
  dislikes   : 0,
  neutral    : 0,
  isSuper    : false,
  isLiked    : false,
  isDisliked : false,
  isNeutral  : false,
  inBookmarks: false
};

class MovieStat extends Component {
  constructor(props) {
    super(props);

    this.handleSendVote = this.handleSendVote.bind(this);
  }

  handleSendVote(entityId, vote) {
    this.props.dispatch(voteRequest(entityId, vote));
  }

  render() {
    return (
      <div className="movie-votes">
        <div
          onClick={() => this.handleSendVote(this.props.id, 'super')}
          className={'movie-vote' + (this.props.isSuper ? ' m-active' : '')}
        >
          <div className="movie-vote__icn">
            <span className={getVoteIconClassById(3, this.props.isSuper)}/>
          </div>

          <div className="movie-vote__counter">{this.props.super}</div>
        </div>

        <div
          onClick={() => this.handleSendVote(this.props.id, 'like')}
          className={'movie-vote' + (this.props.isLiked ? ' m-active' : '')}
        >
          <div className="movie-vote__icn">
            <span className={getVoteIconClassById(2, this.props.isLiked)}/>
          </div>

          <div className="movie-vote__counter">{this.props.likes}</div>
        </div>

        <div
          onClick={() => this.handleSendVote(this.props.id, 'neutral')}
          className={'movie-vote' + (this.props.isNeutral ? ' m-active' : '')}
        >
          <div className="movie-vote__icn">
            <span className={getVoteIconClassById(1, this.props.isNeutral)}/>
          </div>

          <div className="movie-vote__counter">{this.props.neutral}</div>
        </div>

        <div
          onClick={() => this.handleSendVote(this.props.id, 'dislike')}
          className={'movie-vote' + (this.props.isDisliked ? ' m-active' : '')}
        >
          <div className="movie-vote__icn">
            <span className={getVoteIconClassById(0, this.props.isDisliked)}/>
          </div>

          <div className="movie-vote__counter">{this.props.dislikes}</div>
        </div>
      </div>
    );
  }
}

MovieStat.propTypes = propTypes;
MovieStat.defaultProps = defaultProps;

export default connect()(MovieStat);