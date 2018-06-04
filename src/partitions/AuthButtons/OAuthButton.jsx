import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {oAuthSignIn} from 'redux-oauth';
import Button from 'components/Gui/Button';

const propTypes = {
  dispatch: PropTypes.func.isRequired,
  loading : PropTypes.bool.isRequired,
  disabled: PropTypes.bool.isRequired,
  provider: PropTypes.string.isRequired,
  children: PropTypes.string
};

const classAliases = {
  'vkontakte': 'vk',
  'facebook' : 'fb'
};

class OAuthButton extends Component {
  constructor(props) {
    super(props);

    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    const {dispatch, provider, loading, disabled} = this.props;

    if (loading || disabled) {
      return false;
    }

    dispatch(oAuthSignIn({provider}));
  }

  render() {
    const {loading, disabled, provider, children} = this.props;

    return (
      <Button
        loading={loading}
        disabled={disabled}
        onClick={this.handleClick}
        additionClass={'p-signin__btn p-signin__btn_' + classAliases[provider]}
        icn={'soc_' + classAliases[provider]}
      >
        {children}
      </Button>
    );
  }
}

OAuthButton.propTypes = propTypes;

function mapStateToProps(state, ownProps) {
  const loading = state.auth.getIn(['oAuthSignIn', ownProps.provider, 'loading']) || false;

  return {loading};
}

export default connect(mapStateToProps)(OAuthButton);