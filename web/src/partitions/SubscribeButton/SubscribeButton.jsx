import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import Button from 'components/Gui/Button';
import {subscribe} from 'redux/actions/profileFriendsActions';
import {openSignInPopup} from 'redux/actions/appActions';
import {isUserSignedIn} from 'redux/models/user';

const propTypes = {
  dispatch    : PropTypes.func.isRequired,
  userId      : PropTypes.number.isRequired,
  subscribed  : PropTypes.bool,
  userSignedIn: PropTypes.bool.isRequired
};

// Follow / unfollow a user. Guests get the sign-in popup instead.
class SubscribeButton extends Component {
  state = {loading: false};

  handleClick = () => {
    const {dispatch, userId, subscribed, userSignedIn} = this.props;

    if (!userSignedIn) {
      dispatch(openSignInPopup());
      return;
    }

    if (this.state.loading) {
      return;
    }

    this.setState({loading: true});
    dispatch(subscribe(userId, !subscribed))
      .catch(() => false)
      .then(() => this.setState({loading: false}));
  };

  render() {
    const {subscribed} = this.props;

    return (
      <Button
        loading={this.state.loading}
        color={subscribed ? 'light-gray' : 'green'}
        onClick={this.handleClick}
      >
        {subscribed ? 'отписаться' : 'подписаться'}
      </Button>
    );
  }
}

SubscribeButton.propTypes = propTypes;

function mapStateToProps(state) {
  return {userSignedIn: isUserSignedIn(state)};
}

export default connect(mapStateToProps)(SubscribeButton);