import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {isUserSignedIn} from 'redux/models/user';
import Button from 'components/Gui/Button';
import Modal from 'react-modal';
import SignInPage from 'components/SignInPage';
import {openSignInPopup, closeSignInPopup} from 'redux/actions/appActions';

const propTypes = {
  signInPopupOpen: PropTypes.bool.isRequired,
  dispatch       : PropTypes.func.isRequired,
  userSignedIn   : PropTypes.bool.isRequired
};

class SignInButton extends Component {
  constructor(props) {
    super(props);

    this.handleOpenModal = this.handleOpenModal.bind(this);
    this.closeModal = this.closeModal.bind(this);
  }

  handleOpenModal() {
    this.props.dispatch(openSignInPopup());
  }

  closeModal() {
    this.props.dispatch(closeSignInPopup());
  }

  render() {
    const {userSignedIn} = this.props;

    if (userSignedIn) {
      return null;
    }

    return (
      <div className="header__right-item">
        <Button onClick={this.handleOpenModal} size="big" color="gray">Войти</Button>

        <Modal isOpen={this.props.signInPopupOpen} contentLabel="Example Modal">
          <SignInPage handleCrossClick={this.closeModal} />
        </Modal>
      </div>
    );
  }
}

SignInButton.propTypes = propTypes;

function mapStateToProps(state) {
  const userSignedIn = isUserSignedIn(state);
  const signInPopupOpen = state.app.get('signInPopupOpen');

  return {userSignedIn, signInPopupOpen};
}

export default connect(mapStateToProps)(SignInButton);