import React, {Component} from 'react';
import PropTypes from 'prop-types';
import Button from '../Gui/Button';
import Modal from 'react-modal';
import YouTube from 'react-youtube';

class MovieTrailer extends Component {
  static propTypes = {
    trailers: PropTypes.array
  };

  constructor(props) {
    super(props);

    this.state = {
      isOpen      : false,
      trailerIndex: 0
    };
  }

  handleOpenPopup = () => {
    this.setState({isOpen: true});
  };

  handleClosePopup = () => {
    this.setState({isOpen: false});
  };

  handleNextVideo = () => {
    this.setState({trailerIndex: this.state.trailerIndex + 1});
  };

  handlePrevVideo = () => {
    this.setState({trailerIndex: this.state.trailerIndex - 1});
  };

  render() {
    const {trailers} = this.props;
    const {trailerIndex, isOpen} = this.state;

    if (!trailers || !trailers.length) {
      return false;
    }

    return (
      <div>
        <Button onClick={this.handleOpenPopup} size="big" additionClass="movie__trailer-btn">Трейлер</Button>

        <Modal
          isOpen={isOpen}
          onRequestClose={this.handleClosePopup}
          shouldCloseOnOverlayClick
          className="p-trailer"
          contentLabel="Movie trailer"
        >
          <i onClick={this.handleClosePopup} className="icn icn_cross ReactModal__Close" />

          <div className="p-trailer__content">
            <div
              onClick={this.handlePrevVideo}
              className={'p-trailer__content-control m-left' + (trailerIndex <= 0 ? ' m-disabled' : '')}
            ><i className="icn icn_arrow-left" /></div>

            <div className="p-trailer__content-video">
              <div className="p-trailer__content-video-inn">
                <YouTube
                  videoId={trailers[trailerIndex]}
                  opts={{
                    playerVars: {
                      autoplay: 1,
                      showinfo: 0,
                      rel     : 0
                    }
                  }}
                />
              </div>
            </div>

            <div
              onClick={this.handleNextVideo}
              className={'p-trailer__content-control m-right' + (trailerIndex >= trailers.length - 1 ? ' m-disabled' : '')}
            ><i className="icn icn_arrow-right" /></div>
          </div>
        </Modal>
      </div>
    );
  }
}

export default MovieTrailer;