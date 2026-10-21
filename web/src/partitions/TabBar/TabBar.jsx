import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {IndexLink, Link} from 'react-router';
import {getUserModel, isUserSignedIn} from 'redux/models/user';
import {openSearch, openSignInPopup} from 'redux/actions/appActions';

import './TabBar.scss';

const propTypes = {
  dispatch    : PropTypes.func.isRequired,
  user        : PropTypes.object,
  userSignedIn: PropTypes.bool
};

// Bottom navigation for phones; on wider screens the header carries the same links
class TabBar extends Component {
  constructor(props) {
    super(props);

    this.handleOpenSearch = this.handleOpenSearch.bind(this);
    this.handleSignIn = this.handleSignIn.bind(this);
  }

  handleOpenSearch() {
    this.props.dispatch(openSearch());
  }

  handleSignIn() {
    this.props.dispatch(openSignInPopup());
  }

  renderUserTabs() {
    const {user} = this.props;
    const avatar = user.get('avatar');

    return [
      <Link key="friends" to="/profile/friends/" className="tab-bar__item" activeClassName="m-active">
        <i className="tab-bar__icn icn icn_friends" />
        <span className="tab-bar__text">Друзья</span>
      </Link>,
      <Link key="profile" to={'/user/' + user.get('id')} className="tab-bar__item" activeClassName="m-active">
        <span className="tab-bar__icn userpic tab-bar__userpic">
          <span style={{backgroundImage: (avatar ? `url(${avatar})` : null)}} />
        </span>
        <span className="tab-bar__text">Профиль</span>
      </Link>
    ];
  }

  renderGuestTabs() {
    return [
      <Link key="about" to="/about" className="tab-bar__item" activeClassName="m-active">
        <i className="tab-bar__icn icn icn_film" />
        <span className="tab-bar__text">О проекте</span>
      </Link>,
      <span key="signin" onClick={this.handleSignIn} className="tab-bar__item">
        <i className="tab-bar__icn icn icn_friends" />
        <span className="tab-bar__text">Войти</span>
      </span>
    ];
  }

  render() {
    return (
      <nav className="tab-bar">
        <IndexLink to="/" className="tab-bar__item" activeClassName="m-active">
          <i className="tab-bar__icn icn icn_list" />
          <span className="tab-bar__text">Лента</span>
        </IndexLink>
        <span onClick={this.handleOpenSearch} className="tab-bar__item">
          <i className="tab-bar__icn icn icn_loupe" />
          <span className="tab-bar__text">Поиск</span>
        </span>
        {this.props.userSignedIn ? this.renderUserTabs() : this.renderGuestTabs()}
      </nav>
    );
  }
}

TabBar.propTypes = propTypes;

function mapStateToProps(state) {
  const userSignedIn = isUserSignedIn(state);
  const user = getUserModel(state);

  return {user, userSignedIn};
}

export default connect(mapStateToProps)(TabBar);