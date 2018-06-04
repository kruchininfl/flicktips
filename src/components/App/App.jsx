import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {IndexLink, Link} from 'react-router';
import Helmet from 'react-helmet';
import SignInButton from 'partitions/AuthButtons/SignInButton';
import HeaderSearch from 'partitions/HeaderSearch';
import HeaderProfile from 'partitions/HeaderProfile';
import LoadingBar from 'react-redux-loading-bar';

import './App.scss';
import {connect} from 'react-redux';
import YaMetrica from './YaMetrica';
import {socketConnect} from 'socket.io-react';
import {voteUpdateCounters} from '../../redux/actions/voteActions';

const VK = typeof window !== 'undefined' ? window.VK : null;

const propTypes = {
  dispatch: PropTypes.func,
  socket  : PropTypes.any,
  children: PropTypes.node,
  isVkApp : PropTypes.bool
};

class App extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    if (this.props.isVkApp) {
      VK.init(() => {
        VK.callMethod('resizeWindow', '100%', 'auto');
      });
    }

    this.props.socket.on('vote-changed', (data) => {
      this.props.dispatch(voteUpdateCounters(data));
    });
  }

  render() {
    return (
      <div className={'layout' + (this.props.isVkApp ? ' m-vk-app' : '')}>
        <Helmet>
          <title>FlickTips — фильмы, друзья, лайки</title>
          <meta name="description" content="Теперь находить лучшие фильмы и сериалы намного проще.
          Благодаря нашему сервису кино и сериалы можно выбирать не на основе обложки и краткого
          описания или рецензий неизвестных вам критиков, а по оценкам друзей." />

          <meta property="og:title" content="FlickTips — Делитесь впечатлениями о просмотренных фильмах с друзьями." />
          <meta property="og:image" content="https://flick.tips/public/img/logo/1024x1024.png" />
        </Helmet>
        <div className="header">
          <LoadingBar updateTime={100} className="header__loader" />
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
            <a href="mailto:support@flick.tips" className="footer__link">Контакты</a>
            <Link to="/about" className="footer__link">О Проекте</Link>
            <IndexLink to="/" className="footer__logo"><span className="icn icn_logo" /></IndexLink>
          </div>
        </div>

        <YaMetrica />
      </div>
    );
  }
}

App.propTypes = propTypes;

function mapStateToProps(state) {
  const isVkApp = state.app.get('isVkApp');

  return {isVkApp};
}

export default connect(mapStateToProps)(socketConnect(App));