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

  // a done step shows a check instead of its number; the steps can be done in any order
  renderStep(number, done, title, body) {
    return (
      <li className={'tg-block__step' + (done ? ' m-done' : '')}>
        <span className="tg-block__step-mark">
          {done
            ? <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
            </svg>
            : number}
        </span>
        <div className="tg-block__step-body">
          <div className="tg-block__step-title">{title}</div>
          {body}
        </div>
      </li>
    );
  }

  render() {
    const {loaded, linked, username, botUsername, groups, links} = this.state;

    if (!loaded || !links) {
      return false;
    }

    const inGroup = groups.some((group) => group.active);

    return (
      <div className="tg-block">
        <div className="tg-block__title">Оценки в Telegram</div>
        <div className="tg-block__text">
          Бот @{botUsername} публикует ваши оценки фильмов в группах Telegram с друзьями.
        </div>

        <ol className="tg-block__steps">
          {this.renderStep(1, linked, 'Привяжите Telegram', linked
            ? <div className="tg-block__text">
              Привязан{username ? <span> <b>@{username}</b></span> : ''}.
              {' '}<span className="tg-block__link" onClick={this.handleUnlink}>Отвязать</span>
            </div>
            : <div className="tg-block__actions">
              <Button componentClass="a" href={links.startUrl} target="_blank" rel="noopener noreferrer" color="green">
                Привязать Telegram
              </Button>
            </div>
          )}
          {this.renderStep(2, inGroup, 'Добавьте бота в группу', (
            <div>
              <div className="tg-block__text">И нажмите там «Участвовать».</div>
              {groups.length ? this.renderGroups() : ''}
              <div className="tg-block__actions">
                <Button
                  componentClass="a"
                  href={links.groupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  color={inGroup ? 'light-gray' : 'green'}
                >
                  {inGroup ? 'Добавить в ещё одну группу' : 'Добавить бота в группу'}
                </Button>
              </div>
            </div>
          ))}
        </ol>
      </div>
    );
  }
}

TelegramBlock.propTypes = propTypes;

export default connect()(TelegramBlock);