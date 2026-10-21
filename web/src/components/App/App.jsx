import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {IndexLink, Link, browserHistory} from 'react-router';
import Helmet from 'react-helmet';
import SignInButton from 'partitions/AuthButtons/SignInButton';
import HeaderSearch from 'partitions/HeaderSearch';
import HeaderProfile from 'partitions/HeaderProfile';
import TabBar from 'partitions/TabBar';
import LoadingBar from 'react-redux-loading-bar';
import './App.scss';
import {connect} from 'react-redux';
import YaMetrica from './YaMetrica';
import {socketConnect} from 'socket.io-react';
import {voteUpdateCounters} from '../../redux/actions/voteActions';
import {getUserModel, isUserSignedIn} from '../../redux/models/user';
import Button from '../Gui/Button';
import Toggler from '../Gui/Forms/Toggler';
import {profileUpdate} from '../../redux/actions/profileActions';
import {Tooltip} from 'react-tippy';
import {openSignInPopup} from '../../redux/actions/appActions';
import {acceptInvite, takeRememberedInvite} from '../../redux/actions/inviteActions';

const propTypes = {
  dispatch    : PropTypes.func,
  socket      : PropTypes.any,
  children    : PropTypes.node,
  user        : PropTypes.object,
  userSignedIn: PropTypes.bool
};

class App extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.props.socket.on('vote-changed', (data) => {
      this.props.dispatch(voteUpdateCounters(data));
    });

    this.acceptRememberedInvite();
  }

  componentDidUpdate(prevProps) {
    if (this.props.userSignedIn && !prevProps.userSignedIn) {
      this.acceptRememberedInvite();
    }
  }

  handleToggleViewedFilter = () => {
    this.props.dispatch(profileUpdate({
      hide_viewed: +!this.props.user.hide_viewed
    }));
  };

  handleSignIn = () => {
    this.props.dispatch(openSignInPopup());
  };

  // a guest opened an invite link (InvitePage) and has signed in since
  acceptRememberedInvite() {
    if (!this.props.userSignedIn) {
      return;
    }

    const code = takeRememberedInvite();

    if (code) {
      this.props.dispatch(acceptInvite(code))
        .then((inviterId) => {
          if (inviterId !== this.props.user.id) {
            browserHistory.push('/user/' + inviterId);
          }
        })
        .catch(() => false);
    }
  }

  renderAdv() {
    const {userSignedIn} = this.props;

    if (userSignedIn) {
      return false;
    }

    return (
      <div className="about-ttip">
        <div className="about-ttip__inn">
          <div className="about-ttip__body">
            <div className="about-ttip__title">Любишь хорошее кино?</div>
            <div className="about-ttip__text">Оценивай фильмы и смотри, что понравилось друзьям.</div>
          </div>
          <Button onClick={this.handleSignIn} additionClass="about-ttip__btn" size="big" color="blue">
            Присоединиться
          </Button>
        </div>
      </div>
    );
  }

  renderNav() {
    const {user, userSignedIn} = this.props;

    return (
      <nav className="header__nav">
        <IndexLink to="/" className="header__nav-link" activeClassName="m-active">Лента</IndexLink>
        {userSignedIn ? [
          <Link key="friends" to="/profile/friends/" className="header__nav-link" activeClassName="m-active">Друзья</Link>,
          <Link key="bookmarks" to="/profile/bookmarks/" className="header__nav-link" activeClassName="m-active">
            Закладки
          </Link>,
          <Link key="votes" to={'/user/' + user.id} className="header__nav-link" activeClassName="m-active">Мои оценки</Link>
        ] : (
          <Link to="/about" className="header__nav-link" activeClassName="m-active">О проекте</Link>
        )}
      </nav>
    );
  }

  render() {
    return (
      <div className="layout">
        <Helmet>
          <title>FlickTips — фильмы, друзья, лайки</title>
          <meta name="description" content="Рейтинг фильмов и сериалов на основе оценок друзей, кинопоиска и imdb." />

          <meta property="og:title" content="FlickTips — Делитесь впечатлениями о просмотренных фильмах с друзьями." />
          <meta property="og:image" content="https://flicktips.ru/public/img/logo/1024x1024.png" />
        </Helmet>
        <div className="header">
          <LoadingBar updateTime={100} className="header__loader" />
          <div className="wrapper header__inn">
            <IndexLink to="/" className="header__logo"><span className="icn icn_logo" /></IndexLink>

            {this.renderNav()}

            <div className="header__right">
              {this.props.userSignedIn ? (
                <Tooltip
                  title={this.props.user.hide_viewed ? 'Показать просмотренные' : 'Скрыть просмотренные'}
                  position="bottom"
                  trigger="mouseenter"
                  arrow
                  distance={20}
                  delay={300}
                  hideDelay={100}
                >
                  <Toggler
                    checked={this.props.user.hide_viewed}
                    onChange={this.handleToggleViewedFilter}
                  />
                </Tooltip>
              ) : null}
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
          {this.renderAdv()}
          {this.props.children}
        </div>

        <div className="footer">
          <div className="wrapper">
            <a href="mailto:support@flicktips.ru" className="footer__link">Контакты</a>
            <Link to="/about" className="footer__link">О Проекте</Link>
            <IndexLink to="/" className="footer__logo"><span className="icn icn_logo" /></IndexLink>
          </div>
        </div>

        <TabBar />

        <YaMetrica />
      </div>
    );
  }
}

App.propTypes = propTypes;

function mapStateToProps(state) {
  const userSignedIn = isUserSignedIn(state);
  const user = userSignedIn ? getUserModel(state).toJS() : {};

  return {user, userSignedIn};
}

export default connect(mapStateToProps)(socketConnect(App));