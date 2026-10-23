'use client';

// The v2 shell (Figma «Десктоп 1440» / «Планшет 768» / «Мобайл 390»): the sidebar (full or collapsed) with the
// top bar on desktops, the header with the slide-out menu below 1024px.
import { usePathname } from 'next/navigation';
import { Suspense, useState, type ReactNode } from 'react';

import { SignInModal } from '@/components/auth/SignInModal';
import { SearchDialog } from '@/components/search/SearchDialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { setCookie } from '@/lib/cookies';
import { cn } from '@/lib/utils';
import { SIDEBAR_COOKIE } from '@/lib/theme';

import { LiveUpdates } from './LiveUpdates';
import { LoadingBar } from './LoadingBar';
import { Metrika } from './Metrika';
import { PendingActions } from './PendingActions';
import { CollapsedSidebar, Sidebar } from './Sidebar';
import { MobileHeader, TopBar } from './TopBar';

// Pages not redrawn for the new design yet (stage 4 of the redesign): they keep the legacy markup and styles inside
// a dark panel; drop this with the last of them. `legacy` keeps the redesign's base styles off the old markup
// (styles/globals.css). Every other page, the 404 included, is in the new design.
const LEGACY = ['/profile/accounts'];

// Full-screen pages without the sidebar and the header (Figma «Вход», «Инвайт»)
const BARE = ['/signin', '/invite/*'];

const matches = (pages: string[], pathname: string) => {
  const path = pathname.replace(/(.)\/+$/, '$1');
  return pages.some((page) => (page.endsWith('*') ? path.startsWith(page.slice(0, -1)) : path === page));
};

function PageContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!matches(LEGACY, pathname)) return <>{children}</>;
  return (
    <div className="legacy legacy-content">
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

  const toggleSidebar = () => {
    setCollapsed((value) => {
      setCookie(SIDEBAR_COOKIE, value ? 'full' : 'collapsed', 365);
      return !value;
    });
  };

  const extras = (
    <>
      <Suspense fallback={null}>
        <SignInModal />
      </Suspense>
      <SearchDialog />
      <div className="legacy contents">
        <PendingActions />
      </div>
      <LiveUpdates />
      <Metrika />
    </>
  );

  if (matches(BARE, pathname)) {
    return (
      <TooltipProvider>
        <main>{children}</main>
        {extras}
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh">
        <Suspense fallback={null}>
          <LoadingBar className="fixed inset-x-0 top-0 z-60" />
        </Suspense>

        <aside
          className={cn(
            'sticky top-0 z-20 hidden h-dvh shrink-0 border-r border-border lg:block',
            collapsed ? 'w-16' : 'w-64',
          )}
        >
          {collapsed ? <CollapsedSidebar /> : <Sidebar />}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onToggleSidebar={toggleSidebar} />
          <MobileHeader onOpenMenu={() => setMenuOpen(true)} />
          <main className="flex-1 px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-8 lg:px-10 lg:pt-0 lg:pb-10">
            <PageContent>{children}</PageContent>
          </main>
        </div>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" closeLabel="Закрыть меню" className="shadow-popover">
            <SheetTitle className="sr-only">Меню</SheetTitle>
            <SheetDescription className="sr-only">Разделы FlickTips</SheetDescription>
            <Sidebar />
          </SheetContent>
        </Sheet>

        {extras}
      </div>
    </TooltipProvider>
  );
}
