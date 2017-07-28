import React, {Component} from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import 'moment/locale/ru';
import MovieStat from 'partitions/MovieStat';
import config from 'config';

import './MoviePreview.scss';
import {getVoteIconClassById} from '../../helpers';

const propTypes = {
  id           : PropTypes.number.isRequired,
  image        : PropTypes.string,
  title        : PropTypes.string,
  originalTitle: PropTypes.string,
  genres       : PropTypes.array,
  date         : PropTypes.string,
  vote         : PropTypes.number,
  likes        : PropTypes.number,
  dislikes     : PropTypes.number,
  neutral      : PropTypes.number,
  isLiked      : PropTypes.bool,
  isDisliked   : PropTypes.bool,
  isNeutral    : PropTypes.bool,
  inBookmarks  : PropTypes.bool
};

const defaultProps = {
  image        : null,
  title        : null,
  originalTitle: null,
  genres       : [],
  date         : null,
  vote         : null,
  likes        : 0,
  dislikes     : 0,
  neutral      : 0,
  isLiked      : false,
  isDisliked   : false,
  isNeutral    : false,
  inBookmarks  : false
};

class MoviePreview extends Component {
  constructor(props) {
    super(props);

    this.state = {};
  }

  render() {
    return (
      <div className="movie-prev">
        <div className="movie-prev__cover">
          {this.props.image
            ?
              <div
                style={{backgroundImage: `url(${config.tmdb.posterPath185 + this.props.image})`}}
                className="movie-prev__cover-inn"
              >
                <img src={config.tmdb.posterPath185 + this.props.image}
                  alt={this.props.title}
                />
              </div>
            : ''
          }
          {this.props.vote !== null
            ?
              <div className="movie-prev__vote-icn"><i className={'icn ' + getVoteIconClassById(this.props.vote, true)}/> </div>
            : ''
          }
        </div>

        <div className="movie-prev__content">
          {this.props.title || this.props.originalTitle
            ? <div className="movie-prev__title">
              {this.props.title
                ? <strong>{this.props.title}</strong>
                : ''
              }
              {this.props.originalTitle
                ? <span>{this.props.title ? ' / ' : ''}{this.props.originalTitle}</span>
                : ''
              }
            </div>
            : ''
          }

          {this.props.genres.length
            ? <div className="movie-prev__genres">{this.props.genres.join(', ')}</div>
            : ''
          }

          {this.props.date
            ? <div className="movie-prev__date">{moment(this.props.date).format('MMMM YYYY')}</div>
            : ''
          }

          <div className="movie-prev__votes">
            <MovieStat {...this.props} />
          </div>
        </div>
      </div>
    );
  }
}

MoviePreview.propTypes = propTypes;
MoviePreview.defaultProps = defaultProps;

export default MoviePreview;