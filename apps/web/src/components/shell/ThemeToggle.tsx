'use client';

import { IconMoon, IconSun } from '@tabler/icons-react';

import { toggleTheme } from '@/lib/theme';
import { IconButton } from '@/ui/IconButton';

import styles from './Shell.module.scss';

// The moon in the light theme, the sun in the dark one. Both are rendered and CSS shows the right one, so the
// server render is correct even when the theme comes from the system setting.
export function ThemeToggle({ size }: { size?: 36 | 40 }) {
  return (
    <IconButton label="Сменить тему" size={size} onClick={() => toggleTheme()}>
      <IconMoon className={styles.moon} />
      <IconSun className={styles.sun} />
    </IconButton>
  );
}
