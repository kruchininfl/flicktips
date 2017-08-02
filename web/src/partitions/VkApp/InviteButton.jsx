import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import Button from '../../components/Gui/Button';

const propTypes = {
  dispatch: PropTypes.func,
  isVkApp: PropTypes.bool
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
      return false;
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