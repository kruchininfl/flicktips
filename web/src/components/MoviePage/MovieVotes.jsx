import React, {Component} from 'react';
import PropTypes from 'prop-types';
import Button from '../Gui/Button';
import Modal from 'react-modal';
import {connect} from 'react-redux';
import {getFilmVotes} from '../../redux/actions/movieActions';
import {Link} from 'react-router';
import {getStringByVoteId, getTextByVoteId} from '../../helpers';
import VoteIcon from '../Gui/VoteIcon';
import moment from 'moment';

@connect(null)
class MovieVotes extends Component {
  static propTypes = {
    dispatch: PropTypes.func,
    movieId : PropTypes.number.isRequired,
    loading : PropTypes.bool,
    allVotes: PropTypes.array,
    total   : PropTypes.number
  };

  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      isOpen : false
    };
  }

  handleOpenPopup = () => {
    this.props.dispatch(getFilmVotes(this.props.movieId));
    this.setState({isOpen: true});
  };

  handleClosePopup = () => {
    this.setState({isOpen: false});
  };

  render() {
    const isOpenPopup = this.state.isOpen && !this.props.loading && this.props.allVotes.length > 0;

    return (
      <React.Fragment>
        {this.props.total > 0 ? (
          <Button
            onClick={this.handleOpenPopup}
            size="big" color="blue" style="border"
            loading={this.props.loading}
          >
            Все оценки ({this.props.total})
          </Button>
        ) : (
          <Button size="big" color="gray" style="border" disabled>
            Нет оценок
          </Button>
        )}


        <Modal
          isOpen={isOpenPopup}
          onRequestClose={this.handleClosePopup}
          shouldCloseOnOverlayClick
          className="p-votes"
          contentLabel="Movie votes"
        >
          <i onClick={this.handleClosePopup} className="icn icn_cross ReactModal__Close  m-white" />

          <div className="p-votes__content">
            {this.props.allVotes.map(vote => (
              <div key={vote.id} className="vote-details">
                <Link
                  onClick={this.handleClosePopup}
                  className={'link vote-details__user' + (vote.user.isFriend ? ' m-friend' : '')}
                  to={'/user/' + vote.user.id}
                >
                  <div className="userpic userpic_size_big">
                    <span style={{backgroundImage: (vote.user.avatar ? `url(${vote.user.avatar})` : null)}} />
                  </div>

                  <div className="vote-details__user__name">{vote.user.username}</div>
                </Link>

                <div className={'vote-details__value' + ' m-' + getStringByVoteId(vote.vote)}>
                  <VoteIcon vote={vote.vote} active />
                  <span>{getTextByVoteId(vote.vote)}</span>
                </div>

                <div className="vote-details__date">{moment(vote.timestamp).format('LL')}</div>
              </div>
            ))}
          </div>
        </Modal>
      </React.Fragment>
    );
  }
}

export default MovieVotes;