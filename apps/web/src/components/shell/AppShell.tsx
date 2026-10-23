'use client';

// The legacy App component: fixed header (logo, "hide viewed" switch, search, sign-in / profile menu), the
// "join" banner for guests, the page, the footer and the phone tab bar.
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';

import { SignInButton } from '@/components/auth/SignInButton';
import { SignInModal } from '@/components/auth/SignInModal';
import { Button } from '@/components/gui/Button';
import { Toggler } from '@/components/gui/Toggler';
import { Tooltip } from '@/components/gui/Tooltip';
import { useViewer, useViewerActions } from '@/viewer/ViewerProvider';

import { HeaderProfile } from './HeaderProfile';
import { HeaderSearch } from './HeaderSearch';
import { LoadingBar } from './LoadingBar';
import { Metrika } from './Metrika';
import { PendingActions } from './PendingActions';
import { TabBar } from './TabBar';
import { useUi } from './UiProvider';

function ViewedFilter() {
  const viewer = useViewer();
  const { updateProfile } = useViewerActions();
  if (!viewer) return null;

  return (
    <Tooltip
      title={viewer.hide_viewed ? 'Показать просмотренные' : 'Скрыть просмотренные'}
      distance={20}
      delay={300}
      hideDelay={100}
    >
      <Toggler checked={viewer.hide_viewed} onChange={() => void updateProfile({ hide_viewed: !viewer.hide_viewed })} />
    </Tooltip>
  );
}

function JoinBanner() {
  const viewer = useViewer();
  const { openSignIn } = useUi();
  if (viewer) return null;

  return (
    <div className="about-ttip">
      <div className="about-ttip__inn">
        <div className="about-ttip__body">
          <div className="about-ttip__title">Любишь хорошее кино?</div>
          <div className="about-ttip__text">Оценивай фильмы и смотри, что понравилось друзьям.</div>
        </div>
        <Button onClick={openSignIn} className="about-ttip__btn" size="big" color="blue">
          Присоединиться
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <div className="header">
        <Suspense fallback={<div />}>
          <LoadingBar className="header__loader" />
        </Suspense>
        <div className="wrapper header__inn">
          <Link href="/" className="header__logo logo">
            Flick<em>Tips</em>
          </Link>

          <div className="header__right">
            <ViewedFilter />
            <HeaderSearch />
            <SignInButton />
            <HeaderProfile />
          </div>
        </div>
      </div>

      <div className="container">
        <JoinBanner />
        {children}
      </div>

      <div className="footer">
        <div className="wrapper">
          <a href="mailto:support@flicktips.ru" className="footer__link">
            Контакты
          </a>
          <Link href="/about" className="footer__link">
            О Проекте
          </Link>
          <Link href="/" className="footer__logo logo">
            Flick<em>Tips</em>
          </Link>
        </div>
      </div>

      <TabBar />

      <Suspense fallback={null}>
        <SignInModal />
      </Suspense>
      <PendingActions />
      <Metrika />
    </div>
  );
}
