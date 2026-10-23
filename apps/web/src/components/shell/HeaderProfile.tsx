'use client';

import Link from 'next/link';
import { useEffect, useState, type MouseEvent } from 'react';

import { InviteButton } from '@/components/invite/InviteButton';
import { TelegramButton } from '@/components/telegram/TelegramButton';
import { useViewer, useViewerActions } from '@/viewer/ViewerProvider';

import './HeaderProfile.scss';

// The viewer's userpic in the header with the dropdown menu (web/src/partitions/HeaderProfile).
export function HeaderProfile() {
  const viewer = useViewer();
  const { logout } = useViewerActions();
  const [opened, setOpened] = useState(false);

  // any click outside closes the menu
  useEffect(() => {
    if (!opened) return;
    const close = () => setOpened(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [opened]);

  if (!viewer) return null;

  const toggle = (event: MouseEvent) => {
    event.stopPropagation();
    setOpened((o) => !o);
  };

  return (
    <div className="header__right-item">
      <div className="header-search">
        <div className="header-profile">
          <div onClick={toggle} className="userpic header-profile__photo">
            <span style={viewer.avatar ? { backgroundImage: `url(${viewer.avatar})` } : undefined} />
            <div className={'header-profile__menu' + (opened ? ' m-active' : '')}>
              <div className="header-profile__menu-inn">
                <div className="header-profile__menu-links header-profile__menu-invite">
                  <InviteButton buttonClass="header-profile__invite-btn" />
                  <TelegramButton buttonClass="header-profile__invite-btn header-profile__tg-btn" />
                </div>
                <ul className="header-profile__menu-links">
                  <li>
                    <Link href={'/user/' + viewer.id} className="header-profile__menu-link">
                      Мои оценки
                    </Link>
                  </li>
                  <li>
                    <Link href="/profile/bookmarks/" className="header-profile__menu-link">
                      Мои закладки
                    </Link>
                  </li>
                  <li>
                    <Link href="/profile/friends/" className="header-profile__menu-link">
                      Мои друзья
                    </Link>
                  </li>
                  <li>
                    <Link href="/profile/accounts/" className="header-profile__menu-link">
                      Способы входа
                    </Link>
                  </li>
                </ul>

                <ul className="header-profile__menu-links">
                  <li>
                    <span onClick={() => void logout()} className="header-profile__menu-link">
                      Выйти
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
