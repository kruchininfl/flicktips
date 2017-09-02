import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {voteRequest} from 'redux/actions/voteActions';

import './MovieStat.scss';
import {connect} from 'react-redux';

const propTypes = {
  dispatch   : PropTypes.func.isRequired,
  id         : PropTypes.number.isRequired,
  likes      : PropTypes.number,
  dislikes   : PropTypes.number,
  neutral    : PropTypes.number,
  isLiked    : PropTypes.bool,
  isDisliked : PropTypes.bool,
  isNeutral  : PropTypes.bool,
  inBookmarks: PropTypes.bool
};

const defaultProps = {
  likes      : 0,
  dislikes   : 0,
  neutral    : 0,
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
          onClick={() => this.handleSendVote(this.props.id, 'like')}
          className={'movie-vote' + (this.props.isLiked ? ' m-active' : '')}
        >
          <div className="movie-vote__icn">
            <span className="icn icn_heart-like"/>
            <span className="icn icn_heart-like-fill"/>
          </div>

          <div className="movie-vote__counter">{this.props.likes}</div>
        </div>

        <div
          onClick={() => this.handleSendVote(this.props.id, 'neutral')}
          className={'movie-vote' + (this.props.isNeutral ? ' m-active' : '')}
        >
          <div className="movie-vote__icn">
            <span className="icn icn_heart-neutral"/>
            <span className="icn icn_heart-neutral-fill"/>
          </div>

          <div className="movie-vote__counter">{this.props.neutral}</div>
        </div>

        <div
          onClick={() => this.handleSendVote(this.props.id, 'dislike')}
          className={'movie-vote' + (this.props.isDisliked ? ' m-active' : '')}
        >
          <div className="movie-vote__icn">
            <span className="icn icn_heart-dislike"/>
            <span className="icn icn_heart-dislike-fill"/>
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