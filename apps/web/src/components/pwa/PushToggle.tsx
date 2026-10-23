'use client';

// «Уведомления» in the settings: turns Web Push about the followed users' votes (apps/api/docs/push.md) on or off
// for this browser. Renders nothing where push cannot work: no service worker (dev, old browsers), iOS Safari
// outside a home-screen app, or a server without VAPID keys. New in v2 (the Cordova app had no notifications).
// The markup is the caller's (a render prop), the state and the switching are here.
import { useEffect, useState, type ReactNode } from 'react';

import { api } from '@/api/browser';

import { getBrowserSubscription, isPushSupported, subscribePush, unsubscribePush } from './push-client';

type State =
  | { kind: 'hidden' }
  | { kind: 'ready'; publicKey: string; subscribed: boolean; denied: boolean; busy: boolean; error: boolean };

interface PushView {
  status: string;
  error: boolean;
  switchProps: {
    checked: boolean;
    disabled: boolean;
    onCheckedChange: () => void;
    'aria-label': string;
  };
}

export function PushToggle({ children }: { children: (view: PushView) => ReactNode }) {
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
    : state.error
      ? 'Не получилось, попробуйте ещё раз'
      : state.subscribed
        ? 'Когда друзья оценят фильм · на этом устройстве'
        : 'Выключены на этом устройстве';

  return children({
    status,
    error: state.error || state.denied,
    switchProps: {
      checked: state.subscribed,
      disabled: state.busy || state.denied,
      onCheckedChange: toggle,
      'aria-label': state.subscribed ? 'Выключить уведомления' : 'Включить уведомления',
    },
  });
}
