import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {getUserModel} from 'redux/models/user';
import {Link} from 'react-router';
import {signOut} from 'redux-oauth';

import './HeaderProfile.scss';

const propTypes = {
  dispatch: PropTypes.func.isRequired,
  isVkApp : PropTypes.bool,
  user    : PropTypes.any
};

class HeaderProfile extends Component {
  constructor(props) {
    super(props);

    this.handleOpenSearch = this.handleOpenSearch.bind(this);
    this.handleSignOut = this.handleSignOut.bind(this);

    this.state = {
      opened: false
    };
  }

  handleOpenSearch(event) {
    event.stopPropagation();
    this.setState({opened: !this.state.opened});

    const _close = (e) => {
      e.target.removeEventListener(e.type, close);
      this.setState({opened: false});
    };

    window.addEventListener('click', _close);
  }

  handleSignOut() {
    const {dispatch} = this.props;

    dispatch(signOut());
  }

  render() {
    const {user} = this.props;
    const {opened} = this.state;

    if (!user) {
      return false;
    }

    const avatar = user.get('avatar');
    const id = user.get('id');

    return (
      <div className="header__right-item">
        <div className="header-search">
          <div className="header-profile">
            <div
              onClick={this.handleOpenSearch}
              className="userpic header-profile__photo"
            >
              <span style={{backgroundImage: (avatar ? `url(${avatar})` : null)}} />
              <div className={'header-profile__menu' + (opened ? ' m-active' : '')}>
                <div className="header-profile__menu-inn">
                  <ul className="header-profile__menu-links">
                    <li><Link to={'/profile/friends/'} className="header-profile__menu-link">Мои друзья</Link></li>
                    <li><Link to={'/profile/bookmarks/'} className="header-profile__menu-link">Мои закладки</Link></li>
                    <li><Link to={'/user/' + id} className="header-profile__menu-link">Мои оценки</Link></li>
                  </ul>

                  {!this.props.isVkApp
                    ? <div className="header-profile__menu-links">
                      <li><span onClick={this.handleSignOut} className="header-profile__menu-link">Выйти</span></li>
                    </div>
                    : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

HeaderProfile.propTypes = propTypes;

function mapStateToProps(state) {
  const user = getUserModel(state);
  const isVkApp = state.app.get('isVkApp');

  return {user, isVkApp};
}

export default connect(mapStateToProps)(HeaderProfile);