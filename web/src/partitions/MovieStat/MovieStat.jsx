import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {voteRequest} from 'redux/actions/voteActions';

import './MovieStat.scss';
import {connect} from 'react-redux';
import VoteIcon from 'components/Gui/VoteIcon';

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

const VOTES = [
  {name: 'super', id: 3, active: 'isSuper', counter: 'super'},
  {name: 'like', id: 2, active: 'isLiked', counter: 'likes'},
  {name: 'neutral', id: 1, active: 'isNeutral', counter: 'neutral'},
  {name: 'dislike', id: 0, active: 'isDisliked', counter: 'dislikes'}
];

class MovieStat extends Component {
  constructor(props) {
    super(props);

    // Animation runs only after a click, not when the page renders an existing vote.
    // The vote is applied after the API responds, so the clicked icon is shown optimistically meanwhile.
    this.state = {animated: null, animatedOn: false};

    this.handleSendVote = this.handleSendVote.bind(this);
    this.handleAnimationEnd = this.handleAnimationEnd.bind(this);
  }

  handleSendVote(entityId, vote, isActive) {
    this.setState({animated: vote, animatedOn: !isActive});
    this.props.dispatch(voteRequest(entityId, vote));
  }

  handleAnimationEnd(e) {
    if (e.target === e.currentTarget && !e.nativeEvent.pseudoElement) {
      this.setState({animated: null});
    }
  }

  render() {
    return (
      <div className="movie-votes">
        {VOTES.map(({name, id, active, counter}) => {
          const isAnimated = this.state.animated === name;
          const isActive = isAnimated ? this.state.animatedOn : this.props[active];
          let className = 'movie-vote movie-vote_' + name;

          className += isActive ? ' m-active' : '';

          if (isAnimated) {
            className += isActive ? ' m-pop' : ' m-unpop';
          }

          return (
            <div
              key={name}
              onClick={() => this.handleSendVote(this.props.id, name, this.props[active])}
              className={className}
            >
              <div className="movie-vote__icn" onAnimationEnd={this.handleAnimationEnd}>
                <VoteIcon vote={id} active={isActive} />
              </div>

              <div className="movie-vote__counter">{this.props[counter]}</div>
            </div>
          );
        })}
      </div>
    );
  }
}

MovieStat.propTypes = propTypes;
MovieStat.defaultProps = defaultProps;

export default connect()(MovieStat);