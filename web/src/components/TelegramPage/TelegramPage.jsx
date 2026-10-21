import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import Helmet from 'react-helmet';
import Button from 'components/Gui/Button';
import OAuthButton from 'partitions/AuthButtons/OAuthButton';
import {confirmTelegram, rememberTelegramCode, takeRememberedTelegramCode} from 'redux/actions/telegramActions';
import {getUserModel, isUserSignedIn} from 'redux/models/user';

import '../InvitePage/InvitePage.scss';

const propTypes = {
  dispatch    : PropTypes.func,
  location    : PropTypes.any,
  userSignedIn: PropTypes.bool,
  myId        : PropTypes.number
};

// /telegram?code=...: the bot sends here someone who pressed «Участвовать» in a group before linking
// their Telegram to FlickTips. After sign-in the code links the account and joins that group.
class TelegramPage extends Component {
  state = {status: 'idle', group: null};

  componentDidMount() {
    window.scrollTo(0, 0);

    if (this.props.userSignedIn) {
      this.confirm();
    } else {
      // the sign-in may come back on another page, App picks the code up there
      rememberTelegramCode(this.getCode());
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.userSignedIn && !prevProps.userSignedIn) {
      this.confirm();
    }
  }

  getCode() {
    return (this.props.location.query && this.props.location.query.code) || '';
  }

  confirm() {
    if (this.state.status !== 'idle') {
      return;
    }

    takeRememberedTelegramCode();
    this.setState({status: 'pending'});
    this.props.dispatch(confirmTelegram(this.getCode()))
      .then((group) => this.setState({status: 'done', group}))
      .catch(() => this.setState({status: 'error'}));
  }

  renderBody() {
    const {userSignedIn, myId} = this.props;
    const {status, group} = this.state;

    if (!userSignedIn) {
      return (
        <div>
          <div className="p-invite__title">Привяжите Telegram к FlickTips</div>
          <div className="p-invite__text">
            Войдите, и бот начнёт публиковать ваши оценки фильмов в группе Telegram.
          </div>
          <div><OAuthButton disabled={false} provider="vkontakte">Войти через Вконтакте</OAuthButton></div>
          <div><OAuthButton disabled={false} provider="yandex">Войти с Яндекс ID</OAuthButton></div>
        </div>
      );
    }

    if (status === 'error') {
      return (
        <div>
          <div className="p-invite__title">Ссылка устарела</div>
          <div className="p-invite__text">
            Нажмите «Участвовать» в группе ещё раз, и бот пришлёт новую ссылку.
          </div>
        </div>
      );
    }

    if (status !== 'done') {
      return false;
    }

    return (
      <div>
        <div className="p-invite__title">Готово, Telegram привязан</div>
        <div className="p-invite__text">
          {group
            ? `Ваши оценки будут появляться в группе «${group.title}».`
            : 'Теперь нажмите «Участвовать» в группе, где есть бот.'}
        </div>
        <Button color="green" to={'/user/' + myId} additionClass="p-invite__btn">Мой профиль</Button>
      </div>
    );
  }

  render() {
    return (
      <div className="p-invite">
        <Helmet>
          <title>Telegram · FlickTips</title>
          <meta name="robots" content="noindex" />
        </Helmet>

        {this.renderBody()}
      </div>
    );
  }
}

TelegramPage.propTypes = propTypes;

function mapStateToProps(state) {
  const userSignedIn = isUserSignedIn(state);

  return {userSignedIn, myId: userSignedIn ? getUserModel(state).get('id') : undefined};
}

export default connect(mapStateToProps)(TelegramPage);