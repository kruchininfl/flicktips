import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import Button from '../../components/Gui/Button';
import Modal from 'react-modal';
import {ShareButtons} from 'react-share';
import config from 'config';
import {isUserSignedIn} from 'redux/models/user';
import {loadInviteCode} from 'redux/actions/inviteActions';
import QRCode from 'qrcode.react';
import ShareIcon from './ShareIcon';

import './InviteButton.scss';

const {VKShareButton} = ShareButtons;
const shareText = 'Делюсь оценками фильмов на FlickTips — подписывайся!';

const propTypes = {
  dispatch    : PropTypes.func.isRequired,
  userSignedIn: PropTypes.bool.isRequired,
  code        : PropTypes.string,
  // render the opener as an inline text link with this text instead of a button
  linkText    : PropTypes.string,
  linkClass   : PropTypes.string,
  // replaces the default classes of the button opener
  buttonClass : PropTypes.string
};

// Signed-in users get a button that opens a popup with their personal invite link: whoever signs in
// through it and the inviter follow each other. Guests just share the site.
class InviteButton extends Component {
  state = {copied: false, isOpen: false, loading: false};

  componentWillUnmount() {
    clearTimeout(this._copiedTimer);
  }

  // the code is loaded on the first open, then kept in redux
  handleOpen = () => {
    if (this.state.loading) {
      return;
    }

    this.setState({loading: true});
    this.props.dispatch(loadInviteCode())
      .then(() => this.setState({loading: false, isOpen: !!this.props.code}));
  };

  handleClose = () => {
    this.setState({isOpen: false, copied: false});
  };

  handleCopy = () => {
    const link = this.getLink();
    const onCopied = () => {
      this.setState({copied: true});
      clearTimeout(this._copiedTimer);
      this._copiedTimer = setTimeout(() => this.setState({copied: false}), 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(onCopied, () => this.copyWithSelection(onCopied));
    } else {
      this.copyWithSelection(onCopied);
    }
  };

  getLink() {
    return config.siteUrl + '/invite/' + this.props.code;
  }

  copyWithSelection(onCopied) {
    this._input.select();

    try {
      if (document.execCommand('copy')) {
        onCopied();
      }
    } catch (e) {
      // the link stays selected for a manual copy
    }
  }

  renderShareSite() {
    return (
      <div className="share-buttons">
        <VKShareButton url={config.siteUrl}>
          <Button additionClass="invite-btn p-signin__btn p-signin__btn_vk" icn="soc_vk">
            Рассказать во Вконтакте
          </Button>
        </VKShareButton>
      </div>
    );
  }

  renderPopupContent() {
    const link = this.getLink();
    const encodedLink = encodeURIComponent(link);
    const encodedText = encodeURIComponent(shareText);

    return (
      <div className="p-signin">
        <span onClick={this.handleClose} className="icn icn_cross ReactModal__Close" />

        <div className="p-signin__inn invite">
          <div className="invite__title">Пригласите друзей</div>
          <div className="invite__text">
            Отправьте личную ссылку — когда друг войдёт по ней, вы подпишетесь друг на друга.
          </div>

          <div className="invite__qr">
            <QRCode value={link} renderAs="svg" size={160} level="M" />
            <div className="invite__qr-text">Наведите камеру телефона, чтобы открыть ссылку</div>
          </div>

          <div className="invite__link">
            <input
              ref={(ref) => this._input = ref}
              className="invite__link-input"
              type="text"
              value={link}
              readOnly
              onFocus={(e) => e.target.select()}
            />
            <span
              className={'invite__link-copy' + (this.state.copied ? ' m-copied' : '')}
              onClick={this.handleCopy}
              title={this.state.copied ? 'Скопировано' : 'Скопировать ссылку'}
            >
              {this.state.copied ? <ShareIcon name="check" /> : <ShareIcon name="copy" />}
            </span>
          </div>
          <div className="invite__link-status">{this.state.copied ? 'Ссылка скопирована' : ''}</div>

          <div className="invite__share">
            <VKShareButton url={link} title={shareText}>
              <Button additionClass="p-signin__btn p-signin__btn_vk invite__share-btn" icn="soc_vk">ВКонтакте</Button>
            </VKShareButton>
            <a href={`https://t.me/share/url?url=${encodedLink}&text=${encodedText}`} target="_blank" rel="noopener noreferrer">
              <Button additionClass="p-signin__btn invite__share-btn invite__share-btn_tg">
                <span className="btn__icn invite__share-icn"><ShareIcon name="telegram" /></span>Telegram
              </Button>
            </a>
            <a href={`https://wa.me/?text=${encodedText}%20${encodedLink}`} target="_blank" rel="noopener noreferrer">
              <Button additionClass="p-signin__btn invite__share-btn invite__share-btn_wa">
                <span className="btn__icn invite__share-icn"><ShareIcon name="whatsapp" /></span>WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  renderPopup() {
    const {code} = this.props;

    // clicks in the popup portal bubble through React parents (e.g. the header menu toggle)
    return (
      <span onClick={(e) => e.stopPropagation()}>
        <Modal
          isOpen={this.state.isOpen && !!code}
          onRequestClose={this.handleClose}
          shouldCloseOnOverlayClick
          contentLabel="Invite friends"
        >
          {code ? this.renderPopupContent() : ''}
        </Modal>
      </span>
    );
  }

  render() {
    const {userSignedIn, linkText, linkClass, buttonClass} = this.props;

    if (!userSignedIn) {
      return this.renderShareSite();
    }

    if (linkText) {
      return (
        <span>
          <span className={linkClass || 'link'} onClick={this.handleOpen}>{linkText}</span>
          {this.renderPopup()}
        </span>
      );
    }

    return (
      <div className={buttonClass ? '' : 'share-buttons'}>
        <Button
          onClick={this.handleOpen}
          loading={this.state.loading}
          color="blue"
          additionClass={buttonClass || 'invite-btn invite__open-btn'}
        >
          Пригласить друзей
        </Button>

        {this.renderPopup()}
      </div>
    );
  }
}

InviteButton.propTypes = propTypes;

function mapStateToProps(state) {
  return {userSignedIn: isUserSignedIn(state), code: state.invite.get('code')};
}

export default connect(mapStateToProps)(InviteButton);