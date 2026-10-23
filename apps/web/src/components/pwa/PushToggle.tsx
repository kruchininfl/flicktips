'use client';

// «Уведомления» on /profile/accounts/: turns Web Push about the followed users' votes (the header bell's events,
// apps/api/docs/push.md) on or off for this browser. Renders nothing where push cannot work: no service worker
// (dev, old browsers), iOS Safari outside a home-screen app, or a server without VAPID keys. New in v2 (the
// Cordova app had no notifications).
import { useEffect, useState } from 'react';

import { api } from '@/api/browser';
import { Toggler } from '@/components/gui/Toggler';

import { getBrowserSubscription, isPushSupported, subscribePush, unsubscribePush } from './push-client';

type State =
  | { kind: 'hidden' }
  | { kind: 'ready'; publicKey: string; subscribed: boolean; denied: boolean; busy: boolean; error: boolean };

export function PushToggle() {
  const [state, setState] = useState<State>({ kind: 'hidden' });

  useEffect(() => {
    if (!isPushSupported()) return;
    let cancelled = false;

    (async () => {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (!registration) return;
      const { publicKey } = await api.push.key();
      if (!publicKey) return;
      const subscription = await getBrowserSubscription();
      const subscribed = subscription
        ? (await api.me.push.status(subscription.endpoint)).subscribed && Notification.permission === 'granted'
        : false;
      if (!cancelled) {
        setState({
          kind: 'ready',
          publicKey,
          subscribed,
          denied: Notification.permission === 'denied',
          busy: false,
          error: false,
        });
      }
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'hidden') return null;

  const toggle = () => {
    if (state.busy || state.denied) return;
    const turnOn = !state.subscribed;
    setState({ ...state, busy: true, error: false });
    (turnOn ? subscribePush(state.publicKey) : unsubscribePush().then(() => false))
      .then((subscribed) =>
        setState({ ...state, subscribed, busy: false, denied: Notification.permission === 'denied', error: false }),
      )
      .catch(() => setState({ ...state, busy: false, error: true }));
  };

  const status = state.denied
    ? 'Запрещены в настройках браузера'
    : state.subscribed
      ? 'Включены на этом устройстве'
      : 'Выключены';

  return (
    <div className="accounts">
      <div className="accounts__title">Уведомления</div>
      <div className="accounts__hint">
        Сообщим, когда люди, на которых вы подписаны, оценят фильм. Настройка действует только на этом устройстве.
      </div>

      {state.error ? <div className="accounts__notice m-error">Не получилось, попробуйте ещё раз.</div> : null}

      <ul className="accounts__list">
        <li className="accounts__item">
          <span className="accounts__info">
            <span className="accounts__name">Оценки друзей</span>
            <span className={'accounts__status' + (state.subscribed ? ' m-linked' : '')}>{status}</span>
          </span>
          <Toggler
            checked={state.subscribed}
            disabled={state.busy || state.denied}
            onChange={toggle}
            title={state.subscribed ? 'Выключить уведомления' : 'Включить уведомления'}
          />
        </li>
      </ul>
    </div>
  );
}
