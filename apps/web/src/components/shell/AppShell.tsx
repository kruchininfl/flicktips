'use client';

// The v2 shell (Figma «Десктоп 1440» / «Планшет 768» / «Мобайл 390»): the sidebar (full or collapsed) with the
// top bar on desktops, the header with the slide-out menu below 1024px.
import { IconX } from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';

import { SignInModal } from '@/components/auth/SignInModal';
import { setCookie } from '@/lib/cookies';
import { cx } from '@/lib/cx';
import { SIDEBAR_COOKIE } from '@/lib/theme';

import { HeaderSearch } from './HeaderSearch';
import { LiveUpdates } from './LiveUpdates';
import { LoadingBar } from './LoadingBar';
import { Metrika } from './Metrika';
import { PendingActions } from './PendingActions';
import styles from './Shell.module.scss';
import { CollapsedSidebar, Sidebar } from './Sidebar';
import { MobileHeader, TopBar } from './TopBar';

// Pages already redrawn for the new design. The rest keep the legacy markup and styles inside a dark panel
// until they are ported (stage 2 of the redesign); drop this when the list covers every page.
const REDESIGNED = ['/layout'];

function PageContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (REDESIGNED.includes(pathname)) return <>{children}</>;
  return (
    <div className="legacy-content">
      <div className="container">{children}</div>
    </div>
  );
}

export function AppShell({ children, initialCollapsed }: { children: ReactNode; initialCollapsed: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);

  // a link in the menu navigates: close it
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const toggleSidebar = () => {
    setCollapsed((value) => {
      setCookie(SIDEBAR_COOKIE, value ? 'full' : 'collapsed', 365);
      return !value;
    });
  };

  return (
    <div className={cx(styles.shell, collapsed && styles.isCollapsed)}>
      <Suspense fallback={null}>
        <LoadingBar className={styles.loader} />
      </Suspense>

      <aside className={styles.desktopSidebar}>{collapsed ? <CollapsedSidebar /> : <Sidebar />}</aside>

      <div className={styles.main}>
        <TopBar onToggleSidebar={toggleSidebar} />
        <MobileHeader menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((open) => !open)} />
        <main className={styles.content}>
          <PageContent>{children}</PageContent>
        </main>
      </div>

      {menuOpen && (
        <div className={styles.drawer} onClick={() => setMenuOpen(false)}>
          <div className={styles.drawerPanel} onClick={(event) => event.stopPropagation()}>
            <Sidebar />
          </div>
          <button type="button" className={styles.drawerClose} aria-label="Закрыть меню">
            <IconX />
          </button>
        </div>
      )}

      <HeaderSearch />
      <Suspense fallback={null}>
        <SignInModal />
      </Suspense>
      <PendingActions />
      <LiveUpdates />
      <Metrika />
    </div>
  );
}
