'use client';

import { IconChevronRight, IconLogin } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';

import { cx } from '@/lib/cx';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Logo, Mark } from '@/ui/Logo';
import { useViewer } from '@/viewer/ViewerProvider';

import { isActive, navGroups, votesLabel } from './nav';
import styles from './Shell.module.scss';
import { ThemeToggle } from './ThemeToggle';
import { useUi } from './UiProvider';
import { UserMenu } from './UserMenu';

// Figma «Сайдбар» (Режим = Вошёл / Гость): the desktop sidebar and the phone/tablet menu.
export function Sidebar() {
  const viewer = useViewer();
  const pathname = usePathname();
  const { openSignIn } = useUi();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <nav className={styles.sidebar} aria-label="Разделы">
      <div className={styles.sidebarHead}>
        <Logo />
        <ThemeToggle size={36} />
      </div>

      {navGroups(viewer).map((group) => (
        <div key={group.label} className={styles.group}>
          <div className={styles.groupLabel}>{group.label}</div>
          {group.items.map(({ href, label, icon: ItemIcon, count }) => (
            <Link
              key={href}
              href={href}
              className={cx(styles.item, isActive(pathname, href) && styles.active)}
              aria-current={isActive(pathname, href) ? 'page' : undefined}
            >
              <ItemIcon />
              <span className={styles.itemLabel}>{label}</span>
              {!!count && <span className={styles.itemCount}>{count}</span>}
            </Link>
          ))}
        </div>
      ))}

      <div className={styles.footer}>
        {viewer ? (
          <>
            {menuOpen && <UserMenu viewer={viewer} onClose={closeMenu} placement="above" />}
            <button
              type="button"
              className={cx(styles.profile, menuOpen && styles.active)}
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <Avatar src={viewer.avatar} name={viewer.username} size={32} />
              <span className={styles.profileName}>
                <b>{viewer.username}</b>
                <span>{votesLabel(viewer.votes_count)}</span>
              </span>
              <IconChevronRight />
            </button>
          </>
        ) : (
          <div className={styles.invite}>
            <b>Оценивайте кино вместе с друзьями</b>
            <span>Смотрите, что понравилось друзьям, и сохраняйте фильмы на потом.</span>
            <Button size="s" block onClick={openSignIn}>
              Войти
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}

// Figma «Сайдбар свёрнутый»: icons only, 64px.
export function CollapsedSidebar() {
  const viewer = useViewer();
  const pathname = usePathname();
  const { openSignIn } = useUi();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <nav className={cx(styles.sidebar, styles.collapsed)} aria-label="Разделы">
      <Link href="/" className={styles.collapsedMark} aria-label="FlickTips">
        <Mark size={34} />
      </Link>
      {navGroups(viewer).map((group, index) => (
        <div key={group.label} className={styles.collapsedGroup}>
          {index > 0 && <hr />}
          {group.items.map(({ href, label, icon: ItemIcon, count }) => (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={cx(styles.collapsedItem, isActive(pathname, href) && styles.active)}
            >
              <ItemIcon />
              {!!count && <span className={styles.collapsedDot} />}
            </Link>
          ))}
        </div>
      ))}
      <div className={styles.collapsedFooter}>
        <ThemeToggle size={40} />
        {viewer ? (
          <>
            {menuOpen && <UserMenu viewer={viewer} onClose={closeMenu} placement="right" />}
            <button
              type="button"
              className={styles.collapsedProfile}
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Меню профиля"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <Avatar src={viewer.avatar} name={viewer.username} size={32} />
            </button>
          </>
        ) : (
          <IconButton label="Войти" size={40} onClick={openSignIn}>
            <IconLogin />
          </IconButton>
        )}
      </div>
    </nav>
  );
}
