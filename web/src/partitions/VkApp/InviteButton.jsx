import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import Button from '../../components/Gui/Button';
import {ShareButtons} from 'react-share';

const propTypes = {
  dispatch: PropTypes.func,
  isVkApp : PropTypes.bool
};

class InviteButton extends Component {
  constructor(props) {
    super(props);

    this.handleShowPopup = this.handleShowPopup.bind(this);
  }

  handleShowPopup() {
    window.VK.init(() => window.VK.callMethod('showInviteBox'));
  }

  render() {
    const {isVkApp} = this.props;

    if (!isVkApp) {
      const {
        FacebookShareButton,
        VKShareButton
      } = ShareButtons;

      const url = 'https://flick.tips';

      return (
        <div className="share-buttons">
          <VKShareButton url={url}>
            <Button
              additionClass="invite-btn p-signin__btn p-signin__btn_vk"
              icn="soc_vk"
            >
              Рассказать во Вконтакте
            </Button>
          </VKShareButton>
          <FacebookShareButton url={url}>
            <Button
              additionClass="invite-btn p-signin__btn p-signin__btn_fb"
              icn="soc_fb"
            >
              Рассказать в Facebook
            </Button>
          </FacebookShareButton>
        </div>
      );
    }

    return (
      <Button
        onClick={this.handleShowPopup}
        additionClass="invite-btn p-signin__btn p-signin__btn_vk"
        icn="soc_vk"
      >
        Пригласить друзей
      </Button>
    );
  }
}

InviteButton.propTypes = propTypes;

function mapStateToProps(state) {
  const isVkApp = state.app.get('isVkApp');

  return {isVkApp};
}

export default connect(mapStateToProps)(InviteButton);