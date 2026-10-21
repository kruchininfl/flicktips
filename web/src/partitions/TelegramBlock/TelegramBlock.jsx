import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import api from 'api';
import Button from 'components/Gui/Button';

import './TelegramBlock.scss';

const propTypes = {
  dispatch: PropTypes.func.isRequired
};

// Own profile: link Telegram and see the groups where @FlickTipsBot posts my ratings (bot: tg-bot/)
class TelegramBlock extends Component {
  state = {loaded: false, linked: false, username: null, botUsername: '', groups: [], links: null, leaving: null};

  componentDidMount() {
    this.load();
    // the user links the account or joins a group in Telegram and comes back to this tab
    window.addEventListener('focus', this.load);
  }

  componentWillUnmount() {
    window.removeEventListener('focus', this.load);
  }

  handleLeave(chatId) {
    this.setState({leaving: chatId});
    this.props.dispatch(api.leaveTelegramGroup(chatId))
      .then(this.load)
      .catch(() => false)
      .then(() => this.setState({leaving: null}));
  }

  handleUnlink = () => {
    this.props.dispatch(api.unlinkTelegram())
      .then(this.load)
      .catch(() => false);
  };

  load = () => {
    const {dispatch} = this.props;

    // a new code each time: they live 15 minutes and are used once
    return Promise.all([dispatch(api.getTelegram()), dispatch(api.createTelegramLink())])
      .then(([status, link]) => this.setState({
        loaded    : true,
        linked    : status.body.linked,
        username  : status.body.username,
        botUsername: status.body.botUsername,
        groups    : status.body.groups,
        links     : link.body
      }))
      .catch(() => false);
  };

  renderGroups() {
    const {groups, leaving} = this.state;

    if (!groups.length) {
      return (
        <div className="tg-block__text">
          Пока нет групп. Добавьте бота в группу и нажмите там «Участвовать».
        </div>
      );
    }

    return (
      <ul className="tg-block__groups">
        {groups.map((group) => (
          <li key={group.chat_id} className="tg-block__group">
            <span className="tg-block__group-title">
              {group.title || 'Группа без названия'}
              {group.active ? '' : <span className="tg-block__group-note"> · бот удалён из группы</span>}
            </span>
            <Button
              color="light-gray"
              loading={leaving === group.chat_id}
              onClick={() => this.handleLeave(group.chat_id)}
            >
              выйти
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  render() {
    const {loaded, linked, username, botUsername, links} = this.state;

    if (!loaded || !links) {
      return false;
    }

    return (
      <div className="tg-block">
        <div className="tg-block__title">Оценки в Telegram</div>

        {linked
          ? <div className="tg-block__text">
            Telegram привязан{username ? <span>: <b>@{username}</b></span> : ''}.
            {' '}<span className="tg-block__link" onClick={this.handleUnlink}>Отвязать</span>
          </div>
          : <div className="tg-block__text">
            Добавьте бота @{botUsername} в группу с друзьями, и он будет публиковать там ваши оценки фильмов.
          </div>
        }

        {linked ? this.renderGroups() : ''}

        <div className="tg-block__actions">
          <Button componentClass="a" href={links.groupUrl} target="_blank" rel="noopener noreferrer" color="green">
            Добавить бота в группу
          </Button>
          {linked
            ? ''
            : <Button componentClass="a" href={links.startUrl} target="_blank" rel="noopener noreferrer" color="light-gray">
              Привязать Telegram
            </Button>
          }
        </div>
      </div>
    );
  }
}

TelegramBlock.propTypes = propTypes;

export default connect()(TelegramBlock);