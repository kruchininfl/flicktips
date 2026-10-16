import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {asyncConnect} from 'redux-connect';
import Helmet from 'react-helmet';
import {browserHistory} from 'react-router';
import config from 'config';
import Button from 'components/Gui/Button';
import OAuthButton from 'partitions/AuthButtons/OAuthButton';
import InviteButton from 'partitions/InviteButton/InviteButton';
import {getInvite, acceptInvite, rememberInvite} from 'redux/actions/inviteActions';
import {getUserModel, isUserSignedIn} from 'redux/models/user';

import './InvitePage.scss';

const propTypes = {
  dispatch    : PropTypes.func,
  params      : PropTypes.any,
  pending     : PropTypes.bool,
  inviter     : PropTypes.any,
  userSignedIn: PropTypes.bool,
  myId        : PropTypes.number
};

// Landing page of a personal invite link /invite/:code
@asyncConnect([
  {
    key    : 'invite',
    promise: ({params, store}) => store.dispatch(getInvite(params.code))
  }
], mapStateToProps)

class InvitePage extends Component {
  state = {accepting: false};

  componentDidMount() {
    window.scrollTo(0, 0);

    // guests accept it after signing in, see App
    if (!this.props.userSignedIn) {
      rememberInvite(this.props.params.code);
    }
  }

  handleAccept = () => {
    if (this.state.accepting) {
      return;
    }

    this.setState({accepting: true});
    this.props.dispatch(acceptInvite(this.props.params.code))
      .then((inviterId) => browserHistory.push('/user/' + inviterId))
      .catch(() => this.setState({accepting: false}));
  };

  renderActions() {
    const {inviter, userSignedIn, myId} = this.props;

    if (!userSignedIn) {
      return (
        <div>
          <div className="p-invite__hint">Войдите, и вы подпишетесь друг на друга:</div>
          <div><OAuthButton disabled={false} provider="vkontakte">Войти через Вконтакте</OAuthButton></div>
          <div><OAuthButton disabled={false} provider="yandex">Войти с Яндекс ID</OAuthButton></div>
        </div>
      );
    }

    if (inviter.id === myId) {
      return (
        <div>
          <div className="p-invite__hint">Это ваша ссылка-приглашение. Отправьте её друзьям.</div>
          <InviteButton />
        </div>
      );
    }

    return (
      <Button color="green" loading={this.state.accepting} onClick={this.handleAccept} additionClass="p-invite__btn">
        Стать друзьями
      </Button>
    );
  }

  render() {
    const {inviter, pending} = this.props;

    if (pending || !inviter) {
      return false;
    }

    const name = inviter.username || 'Друг';
    const title = `${name} зовёт вас в FlickTips`;
    const description = 'Смотрите фильмы, которые рекомендуют друзья, и делитесь своими оценками.';

    return (
      <div className="p-invite">
        <Helmet>
          <title>{title}</title>
          <meta name="description" content={description} />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={description} />
          <meta property="og:url" content={config.siteUrl + '/invite/' + this.props.params.code} />
          <meta name="robots" content="noindex" />
        </Helmet>

        <div className="userpic userpic_size_big p-invite__pic">
          <span style={{backgroundImage: (inviter.avatar ? `url(${inviter.avatar})` : null)}} />
        </div>
        <div className="p-invite__title">{title}</div>
        <div className="p-invite__text">{description}</div>

        {this.renderActions()}
      </div>
    );
  }
}

InvitePage.propTypes = propTypes;

function mapStateToProps(state) {
  const {pending, inviter} = state.invite.toJS();
  const userSignedIn = isUserSignedIn(state);
  const myId = userSignedIn ? getUserModel(state).get('id') : undefined;

  return {pending, inviter, userSignedIn, myId};
}

export default InvitePage;