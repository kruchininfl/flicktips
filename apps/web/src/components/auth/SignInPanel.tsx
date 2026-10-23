'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { Glyph, Icon } from '@/components/gui/Icon';

import { OAuthButton } from './OAuthButton';
import './SignInPanel.scss';

// /signin?error=… codes from the API (apps/api/docs/auth.md, "Sign-in flow")
const ERRORS: Record<string, string> = {
  state: 'Вход не завершён: попробуйте ещё раз.',
  denied: 'Вход отменён.',
  provider: 'Сервис входа не ответил, попробуйте позже.',
  params: 'Вход не завершён: попробуйте ещё раз.',
};

interface SignInPanelProps {
  // where to come back after signing in
  next: string;
  // in the popup: the cross closes it; on /signin it links home
  onClose?: () => void;
  error?: string | null;
}

// The sign-in screen (web/src/components/SignInPage): used by the /signin page and the sign-in popup.
export function SignInPanel({ next, onClose, error }: SignInPanelProps) {
  useEffect(() => {
    document.body.classList.add('body_mode_popup');
    return () => document.body.classList.remove('body_mode_popup');
  }, []);

  return (
    <div className="p-signin">
      {onClose ? (
        <Icon name="cross" className="ReactModal__Close" onClick={onClose} />
      ) : (
        <Link href="/" className="icn icn_cross ReactModal__Close" aria-label="На главную">
          <Glyph name="cross" />
        </Link>
      )}

      <div className="p-signin__inn">
        <div className="p-signin__logo logo">
          Flick<em>Tips</em>
        </div>
        <div className="p-signin__slogan">
          <strong>Присоединяйся!</strong>
          <br />И смотри фильмы, <br />
          рекомендованные твоими друзьями!
        </div>
        {error ? <div className="p-signin__error">{ERRORS[error] ?? ERRORS.params}</div> : null}
        <div>
          <OAuthButton provider="vkontakte" next={next}>
            Войти через Вконтакте
          </OAuthButton>
        </div>
        <div>
          <OAuthButton provider="yandex" next={next}>
            Войти с Яндекс ID
          </OAuthButton>
        </div>
      </div>
    </div>
  );
}
