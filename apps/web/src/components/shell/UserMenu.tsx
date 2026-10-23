'use client';

import { IconEyeOff, IconLogout, IconSettings } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import type { ViewerProfile } from '@flicktips/shared';

import { cx } from '@/lib/cx';
import { Avatar } from '@/ui/Avatar';
import { Switch } from '@/ui/Switch';
import { useViewerActions } from '@/viewer/ViewerProvider';

import { votesLabel } from './nav';
import styles from './Shell.module.scss';

// Figma «Меню пользователя»: opened from the profile in the sidebar footer.
export function UserMenu({
  viewer,
  onClose,
  placement,
}: {
  viewer: ViewerProfile;
  onClose: () => void;
  // above the footer of the full sidebar, to the right of the collapsed one
  placement: 'above' | 'right';
}) {
  const { updateProfile, logout } = useViewerActions();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    // the click that opened the menu must not close it
    const timer = setTimeout(() => document.addEventListener('pointerdown', onPointer));
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} role="menu" className={cx(styles.userMenu, styles[placement])}>
      <div className={styles.userMenuHead}>
        <Avatar src={viewer.avatar} name={viewer.username} size={40} />
        <div className={styles.userMenuName}>
          <b>{viewer.username}</b>
          <span>{votesLabel(viewer.votes_count)}</span>
        </div>
      </div>
      <hr />
      <label className={styles.userMenuRow}>
        <IconEyeOff />
        <span className={styles.userMenuText}>
          <b>Скрыть просмотренные</b>
          <span>Не показывать фильмы, которые вы уже оценили</span>
        </span>
        <Switch
          checked={viewer.hide_viewed}
          onChange={(checked) => void updateProfile({ hide_viewed: checked })}
          label="Скрыть просмотренные"
        />
      </label>
      <hr />
      <Link href="/profile/accounts/" className={styles.userMenuRow} onClick={onClose} role="menuitem">
        <IconSettings />
        Настройки
      </Link>
      <button
        type="button"
        role="menuitem"
        className={cx(styles.userMenuRow, styles.danger)}
        onClick={() => {
          onClose();
          void logout();
        }}
      >
        <IconLogout />
        Выйти
      </button>
    </div>
  );
}
