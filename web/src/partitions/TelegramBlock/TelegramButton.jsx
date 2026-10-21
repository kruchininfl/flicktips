import React, {Component} from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-modal';
import TelegramBlock from './TelegramBlock';

const propTypes = {
  className: PropTypes.string
};

// Own profile: a text link that opens the Telegram block in a popup. The block loads its data on mount,
// so nothing is requested until the popup is opened.
class TelegramButton extends Component {
  state = {isOpen: false};

  handleOpen = () => {
    this.setState({isOpen: true});
  };

  handleClose = () => {
    this.setState({isOpen: false});
  };

  render() {
    return (
      <span>
        <span className={this.props.className} onClick={this.handleOpen}>Оценки в Telegram</span>

        {/* clicks in the popup portal bubble through React parents */}
        <span onClick={(e) => e.stopPropagation()}>
          <Modal
            isOpen={this.state.isOpen}
            onRequestClose={this.handleClose}
            shouldCloseOnOverlayClick
            contentLabel="Telegram"
          >
            <div className="p-signin">
              <span onClick={this.handleClose} className="icn icn_cross ReactModal__Close" />
              <div className="p-signin__inn tg-popup">
                <TelegramBlock />
              </div>
            </div>
          </Modal>
        </span>
      </span>
    );
  }
}

TelegramButton.propTypes = propTypes;

export default TelegramButton;