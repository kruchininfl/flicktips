'use client';

import { IconLayoutSidebar, IconMenu2, IconSearch } from '@tabler/icons-react';
import { useEffect, useSyncExternalStore } from 'react';

import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';

import { useUi } from './UiProvider';

const noSubscribe = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

// Figma «Кнопка поиска»: opens the search; Ctrl K / ⌘K anywhere does the same.
function SearchButton() {
  const { openSearch } = useUi();
  // the server renders «Ctrl K»; Macs switch to «⌘ K» after hydration
  const mac = useSyncExternalStore(noSubscribe, isMac, () => false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openSearch]);

  return (
    <button
      type="button"
      onClick={openSearch}
      className="flex h-9 items-center gap-2 rounded-full border border-border bg-card pr-2 pl-3 text-faint hover:border-border-strong"
    >
      <IconSearch className="size-4 text-foreground" />
      <span>Найти фильм или друга</span>
      <kbd className="rounded-[6px] bg-muted px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground">
        {mac ? '⌘ K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}

// Figma «Верхняя панель» (desktop): the sidebar toggle on the left, the search on the right.
export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  return (
    <header className="hidden h-14 items-center justify-between py-2 pr-10 pl-8 lg:flex">
      <Button variant="ghost" size="icon" aria-label="Свернуть меню" title="Свернуть меню" onClick={onToggleSidebar}>
        <IconLayoutSidebar />
      </Button>
      <SearchButton />
    </header>
  );
}

// Figma «Мобильная шапка» (tablet and phone): the menu, the logo and the search.
export function MobileHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { openSearch } = useUi();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-border bg-page pr-3 pl-2 lg:hidden">
      <Button variant="ghost" size="icon" aria-label="Меню" onClick={onOpenMenu}>
        <IconMenu2 />
      </Button>
      <Logo />
      <Button variant="outline" size="icon" aria-label="Поиск" className="ml-auto" onClick={openSearch}>
        <IconSearch />
      </Button>
    </header>
  );
}
