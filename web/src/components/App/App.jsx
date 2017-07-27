import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {IndexLink} from 'react-router';
import Helmet from 'react-helmet';
import SignInButton from 'partitions/AuthButtons/SignInButton';
import HeaderSearch from 'partitions/HeaderSearch';
import HeaderProfile from 'partitions/HeaderProfile';

import './App.scss';

const propTypes = {
  children: PropTypes.node
};

class App extends Component {
  render() {
    return (
      <div className="layout">
        <Helmet>
          <meta charSet="utf-8"/>
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

        <div className="container">
          {this.props.children}
        </div>

        <div className="footer">
          <div className="wrapper">
            <div className="footer__copy">Copyright &copy; 2017</div>
            <IndexLink to="/" className="footer__logo"><span className="icn icn_logo" /></IndexLink>
          </div>
        </div>
      </div>
    );
  }
}

App.propTypes = propTypes;

export default App;