'use client';

import { IconLayoutSidebar, IconMenu2, IconSearch, IconX } from '@tabler/icons-react';
import { useEffect, useSyncExternalStore } from 'react';

import { IconButton } from '@/ui/IconButton';
import { Logo } from '@/ui/Logo';

import styles from './Shell.module.scss';
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
    <button type="button" className={styles.searchButton} onClick={openSearch}>
      <IconSearch />
      <span>Найти фильм или друга</span>
      <kbd>{mac ? '⌘ K' : 'Ctrl K'}</kbd>
    </button>
  );
}

// Figma «Верхняя панель» (desktop): the sidebar toggle on the left, the search on the right.
export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  return (
    <header className={styles.topBar}>
      <IconButton label="Свернуть меню" onClick={onToggleSidebar}>
        <IconLayoutSidebar />
      </IconButton>
      <SearchButton />
    </header>
  );
}

// Figma «Мобильная шапка» (tablet and phone): the menu, the logo and the search.
export function MobileHeader({ menuOpen, onToggleMenu }: { menuOpen: boolean; onToggleMenu: () => void }) {
  const { openSearch } = useUi();
  return (
    <header className={styles.mobileHeader}>
      <IconButton label={menuOpen ? 'Закрыть меню' : 'Меню'} onClick={onToggleMenu} aria-expanded={menuOpen}>
        {menuOpen ? <IconX /> : <IconMenu2 />}
      </IconButton>
      <Logo />
      <IconButton label="Поиск" variant="outline" onClick={openSearch} className={styles.mobileSearch}>
        <IconSearch />
      </IconButton>
    </header>
  );
}
