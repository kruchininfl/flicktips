'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon } from '@/components/gui/Icon';
import { Userpic } from '@/components/gui/Userpic';
import { cx } from '@/lib/cx';
import { useViewer } from '@/viewer/ViewerProvider';

import { useUi } from './UiProvider';
import './TabBar.scss';

const trim = (path: string) => path.replace(/\/+$/, '') || '/';

// react-router's activeClassName: the link's path or anything under it ('/' only exactly)
function isActive(pathname: string, href: string) {
  const current = trim(pathname);
  const target = trim(href);
  return target === '/' ? current === '/' : current === target || current.startsWith(target + '/');
}

// Bottom navigation for phones; on wider screens the header carries the same links (web/src/partitions/TabBar).
export function TabBar() {
  const viewer = useViewer();
  const pathname = usePathname();
  const { openSearch, openSignIn } = useUi();

  const item = (href: string) => cx('tab-bar__item', isActive(pathname, href) && 'm-active');

  return (
    <nav className="tab-bar">
      <Link href="/" className={item('/')}>
        <Icon name="list" className="tab-bar__icn" />
        <span className="tab-bar__text">Лента</span>
      </Link>
      <span onClick={openSearch} className="tab-bar__item">
        <Icon name="loupe" className="tab-bar__icn" />
        <span className="tab-bar__text">Поиск</span>
      </span>
      {viewer ? (
        <>
          <Link href="/profile/friends/" className={item('/profile/friends/')}>
            <Icon name="friends" className="tab-bar__icn" />
            <span className="tab-bar__text">Друзья</span>
          </Link>
          <Link href={'/user/' + viewer.id} className={item('/user/' + viewer.id)}>
            <Userpic avatar={viewer.avatar} className="tab-bar__icn tab-bar__userpic" />
            <span className="tab-bar__text">Профиль</span>
          </Link>
        </>
      ) : (
        <>
          <Link href="/about" className={item('/about')}>
            <Icon name="film" className="tab-bar__icn" />
            <span className="tab-bar__text">О проекте</span>
          </Link>
          <span onClick={openSignIn} className="tab-bar__item">
            <Icon name="friends" className="tab-bar__icn" />
            <span className="tab-bar__text">Войти</span>
          </span>
        </>
      )}
    </nav>
  );
}
