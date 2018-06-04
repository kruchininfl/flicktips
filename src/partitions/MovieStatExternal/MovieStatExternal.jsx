import React, {Component} from 'react';
import PropTypes from 'prop-types';

import './MovieStatExternal.scss';

const propTypes = {
  kpValue      : PropTypes.number,
  imdbValue    : PropTypes.number,
  additionClass: PropTypes.string
};

function getModClass(val) {
  if (val >= 6.8) {
    return 'm-high';
  } else if (val >= 6) {
    return 'm-medium';
  } else if (val > 0) {
    return 'm-low';
  }

  return 'm-na';
}

class MovieStatExternal extends Component {
  render() {
    const {kpValue, imdbValue, additionClass} = this.props;

    if (typeof kpValue === 'undefined' && typeof imdbValue === 'undefined') {
      return false;
    }

    return (
      <div className={'movie-eStat ' + additionClass || ''}>
        <div className="movie-eStat__item">
          <i className="movie-eStat__item-icn m-kp" />
          <div className={'movie-eStat__item-val ' + getModClass(kpValue)}>
            {kpValue ? kpValue.toFixed(1) : 'N/A'}
          </div>
        </div>
        <div className="movie-eStat__item">
          <i className="movie-eStat__item-icn m-imdb" />
          <div className={'movie-eStat__item-val ' + getModClass(imdbValue)}>
            {imdbValue ? imdbValue.toFixed(1) : 'N/A'}
          </div>
        </div>
      </div>
    );
  }
}

MovieStatExternal.propTypes = propTypes;

export default MovieStatExternal;