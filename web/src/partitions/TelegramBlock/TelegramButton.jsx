import React, {Component} from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-modal';
import Button from 'components/Gui/Button';
import ShareIcon from '../InviteButton/ShareIcon';
import TelegramBlock from './TelegramBlock';

const propTypes = {
  className  : PropTypes.string,
  // render the opener as a Telegram-blue button with these extra classes instead of a text link
  buttonClass: PropTypes.string
};

// A text link or a Telegram-colored button that opens the Telegram block in a popup. The block loads its data on mount,
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
        {this.props.buttonClass === undefined
          ? <span className={this.props.className} onClick={this.handleOpen}>Оценки в Telegram</span>
          : <Button onClick={this.handleOpen} additionClass={'tg-open-btn ' + this.props.buttonClass}>
            <span className="btn__icn tg-open-btn__icn"><ShareIcon name="telegram" /></span>Оценки в Telegram
          </Button>
        }

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