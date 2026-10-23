'use client';

import { IconMoon, IconSun } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { toggleTheme } from '@/lib/theme';

// The moon in the light theme, the sun in the dark one. Both are rendered and CSS shows the right one, so the
// server render is correct even when the theme comes from the system setting.
export function ThemeToggle({ square }: { square?: boolean }) {
  return (
    <Button
      variant="ghost"
      size={square ? 'icon-square' : 'icon'}
      aria-label="Сменить тему"
      title="Сменить тему"
      onClick={() => toggleTheme()}
    >
      <IconMoon className="dark:hidden" />
      <IconSun className="hidden dark:block" />
    </Button>
  );
}
