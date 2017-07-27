import React, {Component} from 'react';
import PropTypes from 'prop-types';

import './Profile.scss';

const propTypes = {
  children: PropTypes.node,
  user: PropTypes.any
};

class ProfileLayout extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    window.scrollTo(0, 0);
  }

  render() {
    const {user} = this.props;

    return (
      <div>
        <div className="profile__user">
          <div className="userpic userpic_size_big profile__user-photo">
            <span style={{backgroundImage: (user.avatar ? `url(${user.avatar})` : null)}} />
          </div>
          {user.username ?
            <div className="profile__user-name">{user.username}</div>
            : ''}
        </div>

        {this.props.children}
      </div>
    );
  }
}

ProfileLayout.propTypes = propTypes;

export default ProfileLayout;