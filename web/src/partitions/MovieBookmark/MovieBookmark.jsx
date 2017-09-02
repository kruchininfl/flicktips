import React, {Component} from 'react';
import PropTypes from 'prop-types';
import './MovieBookmark.scss';
import {connect} from 'react-redux';
import {toggleBookmark} from '../../redux/actions/bookmarkActions';

const propTypes = {
  dispatch   : PropTypes.func.isRequired,
  id         : PropTypes.number.isRequired,
  inBookmarks: PropTypes.bool
};

const defaultProps = {
  inBookmarks: false
};

class MovieBookmark extends Component {
  constructor(props) {
    super(props);

    this.handleToggleBookmark = this.handleToggleBookmark.bind(this);
  }

  handleToggleBookmark(entityId) {
    this.props.dispatch(toggleBookmark(entityId));
  }

  render() {
    return (
      <div
        onClick={() => this.handleToggleBookmark(this.props.id)}
        className={'movie-bookmark' + (this.props.inBookmarks ? ' m-active' : '')}
      >
        <div className="movie-bookmark__icn">
          <i className="icn icn_checked"/>
        </div>
      </div>
    );
  }
}

MovieBookmark.propTypes = propTypes;
MovieBookmark.defaultProps = defaultProps;

export default connect()(MovieBookmark);