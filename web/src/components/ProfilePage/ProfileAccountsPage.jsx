import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {browserHistory} from 'react-router';
import api from 'api';
import Button from 'components/Gui/Button';
import Spinner from 'components/Gui/Spinner';
import {authenticateComplete} from 'partitions/redux-oauth';
import openLinkPopup from 'partitions/AccountLink/openLinkPopup';
import {getUserModel, isUserSignedIn} from 'redux/models/user';
import ProfileLayout from './ProfileLayout';

import './ProfileAccounts.scss';

const propTypes = {
  dispatch    : PropTypes.func.isRequired,
  user        : PropTypes.any,
  userSignedIn: PropTypes.bool
};

const SERVICES = [
  {id: 'vkontakte', name: 'ВКонтакте', short: 'vk', label: 'VK'},
  {id: 'yandex', name: 'Яндекс ID', short: 'ya', label: 'Я'}
];

function serviceName(id) {
  return SERVICES.filter(service => service.id === id)[0].name;
}

function plural(n, forms) {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return n + ' ' + forms[0];
  }

  return n + ' ' + (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? forms[1] : forms[2]);
}

function errorText(err) {
  const body = err && err.response && err.response.body;

  if (body && body.msg === 'sign-in expired, try again') {
    return 'Вход устарел, попробуйте ещё раз.';
  }

  return 'Что-то пошло не так, попробуйте ещё раз.';
}

// Sign-in methods of the current user: link VK / Yandex ID, unlink them, and merge in the account that
// already signs in with the one being linked
class ProfileAccountsPage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      services: null,
      busy    : null,
      conflict: null,
      merging : false,
      notice  : null
    };

    this.handleMerge = this.handleMerge.bind(this);
    this.handleCancelMerge = this.handleCancelMerge.bind(this);
  }

  componentDidMount() {
    window.scrollTo(0, 0);

    if (!this.props.userSignedIn) {
      return browserHistory.push('/signin');
    }

    this.loadServices();
  }

  handleLink(service) {
    if (this.state.busy) {
      return;
    }

    this.setState({busy: service, conflict: null, notice: null});

    openLinkPopup(service)
      .then((proof) => {
        if (!proof) {
          return this.setState({busy: null});
        }

        return this.props.dispatch(api.linkAccount(proof))
          .then(({body}) => {
            if (body.status === 'conflict') {
              return this.setState({busy: null, conflict: {proof, service: body.service, merge: body.merge}});
            }

            this.setState({busy: null, services: body.services, notice: {text: serviceName(service) + ' привязан.'}});
          });
      })
      .catch(err => this.setState({busy: null, notice: {error: true, text: errorText(err)}}));
  }

  handleUnlink(service) {
    if (this.state.busy) {
      return;
    }

    this.setState({busy: service, conflict: null, notice: null});

    this.props.dispatch(api.unlinkAccount(service))
      .then(({body}) => this.setState({
        busy    : null,
        services: body.services,
        notice  : {text: serviceName(service) + ' отвязан.'}
      }))
      .catch(err => this.setState({busy: null, notice: {error: true, text: errorText(err)}}));
  }

  handleMerge() {
    const {conflict, merging} = this.state;

    if (merging) {
      return;
    }

    this.setState({merging: true});

    this.props.dispatch(api.mergeAccount(conflict.proof))
      .then(({body}) => {
        this.setState({
          merging : false,
          conflict: null,
          services: body.services,
          notice  : {text: 'Аккаунты объединены: оценки, закладки и подписки теперь здесь.'}
        });
        this.refreshUser();
      })
      .catch(err => this.setState({merging: false, conflict: null, notice: {error: true, text: errorText(err)}}));
  }

  handleCancelMerge() {
    this.setState({conflict: null});
  }

  getStatusText(linked, isLast) {
    if (!linked) {
      return 'Не привязан';
    }

    return isLast ? 'Привязан · единственный способ входа' : 'Привязан';
  }

  loadServices() {
    this.props.dispatch(api.getAccounts())
      .then(response => this.setState({services: response.body.services}))
      .catch(() => this.setState({notice: {error: true, text: 'Не удалось загрузить способы входа.'}}));
  }

  refreshUser() {
    const {dispatch} = this.props;

    return dispatch(api.checkUser())
      .then(response => response.body.success && dispatch(authenticateComplete(response.body.data)));
  }

  renderService(service) {
    const {services, busy} = this.state;
    const linked = services[service.id];
    const linkedCount = SERVICES.filter(item => services[item.id]).length;
    const isLast = linked && linkedCount < 2;

    return (
      <li key={service.id} className="accounts__item">
        <span className={'accounts__badge accounts__badge_' + service.short}>{service.label}</span>
        <span className="accounts__info">
          <span className="accounts__name">{service.name}</span>
          <span className={'accounts__status' + (linked ? ' m-linked' : '')}>
            {this.getStatusText(linked, isLast)}
          </span>
        </span>
        {linked
          ? <Button
            key="unlink"
            color="gray"
            style="border"
            disabled={isLast || !!busy}
            loading={busy === service.id}
            onClick={() => !isLast && this.handleUnlink(service.id)}
          >
            Отвязать
          </Button>
          : <Button
            key="link"
            color="blue"
            disabled={!!busy}
            loading={busy === service.id}
            onClick={() => this.handleLink(service.id)}
          >
            Привязать
          </Button>
        }
      </li>
    );
  }

  renderConflict() {
    const {conflict, merging} = this.state;
    const {merge, service} = conflict;
    const other = merge.user;
    const name = other.username || 'Без имени';

    return (
      <div className="accounts__merge">
        <div className="accounts__merge-title">{serviceName(service)} уже входит в другой аккаунт FlickTips</div>

        <div className="accounts__merge-user">
          <span className="userpic accounts__merge-photo">
            <span style={{backgroundImage: (other.avatar ? `url(${other.avatar})` : null)}} />
          </span>
          <span>
            <span className="accounts__merge-name">{name}</span>
            <span className="accounts__merge-stats">
              {plural(merge.votes, ['оценка', 'оценки', 'оценок'])}
              {' · '}{plural(merge.bookmarks, ['закладка', 'закладки', 'закладок'])}
              {' · '}{plural(merge.following, ['подписка', 'подписки', 'подписок'])}
            </span>
          </span>
        </div>

        {merge.blocking.length
          ? <div className="accounts__merge-text">
            Объединить не получится: к обоим аккаунтам привязаны разные профили
            {' '}{merge.blocking.map(serviceName).join(' и ')}.
          </div>
          : <div className="accounts__merge-text">
            Объединить аккаунты? Оценки, закладки и подписки перейдут в этот аккаунт, а «{name}» будет удалён.
            Входить можно будет любым из способов.
            {merge.conflicts
              ? ' ' + plural(merge.conflicts, ['фильм оценён', 'фильма оценены', 'фильмов оценены'])
                + ' в обоих аккаунтах по-разному: останется более свежая оценка.'
              : ''}
          </div>
        }

        <div className="accounts__merge-actions">
          {merge.blocking.length
            ? ''
            : <Button color="blue" size="big" loading={merging} onClick={this.handleMerge}>Объединить</Button>}
          <Button color="gray" style="border" size="big" disabled={merging} onClick={this.handleCancelMerge}>
            {merge.blocking.length ? 'Понятно' : 'Отмена'}
          </Button>
        </div>
      </div>
    );
  }

  render() {
    const {user} = this.props;
    const {services, conflict, notice} = this.state;

    if (!user) {
      return false;
    }

    return (
      <div className="profile">
        <ProfileLayout user={user} />

        <div className="accounts">
          <div className="accounts__title">Способы входа</div>
          <div className="accounts__hint">
            Привяжите ВКонтакте и Яндекс ID, чтобы входить в этот аккаунт любым из них.
            Если у вас уже есть второй аккаунт FlickTips, его можно объединить с этим.
          </div>

          {notice
            ? <div className={'accounts__notice' + (notice.error ? ' m-error' : '')}>{notice.text}</div>
            : ''}

          {services
            ? <ul className="accounts__list">{SERVICES.map(service => this.renderService(service))}</ul>
            : <div className="accounts__loading"><Spinner active size="small" /></div>}

          {conflict ? this.renderConflict() : ''}
        </div>
      </div>
    );
  }
}

ProfileAccountsPage.propTypes = propTypes;

function mapStateToProps(state) {
  const userSignedIn = isUserSignedIn(state);
  const user = userSignedIn && getUserModel(state) ? getUserModel(state).toJS() : undefined;

  return {user, userSignedIn};
}

export default connect(mapStateToProps)(ProfileAccountsPage);