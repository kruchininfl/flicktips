import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {IndexLink} from 'react-router';
import Helmet from 'react-helmet';
import SignInButton from 'partitions/AuthButtons/SignInButton';
import HeaderSearch from 'partitions/HeaderSearch';
import HeaderProfile from 'partitions/HeaderProfile';

import './App.scss';
import {connect} from 'react-redux';

const VK = typeof window !== 'undefined' ? window.VK : null;

const propTypes = {
  children: PropTypes.node,
  isVkApp : PropTypes.bool
};

class App extends Component {
  componentDidMount() {
    if (this.props.isVkApp) {
      VK.init(() => {
        VK.callMethod('resizeWindow', '100%', 'auto');
      });
    }
  }

  render() {
    return (
      <div className={'layout' + (this.props.isVkApp ? ' m-vk-app' : '')}>
        <Helmet>
          <meta charSet="utf-8" />
          <title>FlickTips</title>
        </Helmet>
        <div className="header">
          <div className="wrapper">
            <IndexLink to="/" className="header__logo"><span className="icn icn_logo" /></IndexLink>

            <div className="header__right">
              <HeaderSearch />
              <SignInButton />
              <HeaderProfile />
            </div>
          </div>
        </div>

        <div
          className="container"
          ref={(ref) => this._container = ref}
        >
          {this.props.children}
        </div>

        <div className="footer">
          <div className="wrapper">
            <a href="mailto:support@flick.tips" className="footer__mail">support@flick.tips</a>
            <IndexLink to="/" className="footer__logo"><span className="icn icn_logo" /></IndexLink>
          </div>
        </div>
      </div>
    );
  }
}

App.propTypes = propTypes;

function mapStateToProps(state) {
  const isVkApp = state.app.get('isVkApp');

  return {isVkApp};
}

export default connect(mapStateToProps)(App);