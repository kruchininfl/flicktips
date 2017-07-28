import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {Link, browserHistory} from 'react-router';
import {isUserSignedIn} from 'redux/models/user';
import OAuthButton from 'partitions/AuthButtons/OAuthButton';

import './SignInPage.scss';

const propTypes = {
  handleCrossClick: PropTypes.func,
  userSignedIn    : PropTypes.bool.isRequired,
  loadingVk       : PropTypes.bool.isRequired,
  loadingFb       : PropTypes.bool.isRequired
};

class SignInPage extends Component {
  componentDidMount() {
    document.body.classList.add('body_mode_popup');
  }

  componentWillUnmount() {
    document.body.classList.remove('body_mode_popup');
  }

  render() {
    const {handleCrossClick, loadingFb, loadingVk, userSignedIn} = this.props;

    if (userSignedIn) {
      if (browserHistory) {
        setTimeout(() => browserHistory.push('/'), 0);
      }
      return false;
    }

    return (
      <div className="p-signin">
        {
          handleCrossClick
            ? <span onClick={handleCrossClick} className="icn icn_cross p-signin__close" />
            : <Link to="/" className="icn icn_cross p-signin__close"/>
        }

        <div className="p-signin__inn">
          <div className="p-signin__logo"><i className="icn icn_logo">&nbsp;</i></div>
          <div className="p-signin__slogan">
            <strong>Присоединяйся!</strong>
            <br />И смотри фильмы, <br />
            рекомендованные твоими друзьями!
          </div>
          <div>
            <OAuthButton disabled={loadingFb} loading={loadingVk} provider="vkontakte">Войти через Вконтакте</OAuthButton>
          </div>
          <div>
            <OAuthButton disabled={loadingVk} loading={loadingFb} provider="facebook">Войти через Facebook</OAuthButton>
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  const loadingVk = state.auth.getIn(['oAuthSignIn', 'vkontakte', 'loading']) || false;
  const loadingFb = state.auth.getIn(['oAuthSignIn', 'facebook', 'loading']) || false;

  return {userSignedIn: isUserSignedIn(state), loadingVk, loadingFb};
}

SignInPage.propTypes = propTypes;

export default connect(mapStateToProps)(SignInPage);