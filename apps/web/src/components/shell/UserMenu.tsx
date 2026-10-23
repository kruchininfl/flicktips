'use client';

import { IconEyeOff, IconLogout, IconSettings } from '@tabler/icons-react';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import type { ViewerProfile } from '@flicktips/shared';

import { UserAvatar } from '@/components/brand/UserAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { useViewerActions } from '@/viewer/ViewerProvider';

import { votesLabel } from './nav';

// Figma «Меню пользователя»: opened from the profile in the sidebar footer, above it in the full sidebar and to
// the right of the collapsed one.
export function UserMenu({
  viewer,
  side,
  children,
}: {
  viewer: ViewerProfile;
  side: ComponentProps<typeof DropdownMenuContent>['side'];
  // the trigger
  children: ReactNode;
}) {
  const { updateProfile, logout } = useViewerActions();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start" sideOffset={side === 'right' ? 12 : 4} className="w-[280px]">
        <div className="flex items-center gap-3 p-2.5">
          <UserAvatar src={viewer.avatar} name={viewer.username} size={40} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <b className="truncate font-medium">{viewer.username}</b>
            <span className="type-caption text-muted-foreground">{votesLabel(viewer.votes_count)}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          role="menuitemcheckbox"
          aria-checked={viewer.hide_viewed}
          className="gap-3 [&_svg:not([class*='size-'])]:size-[18px]"
          onSelect={(event) => {
            // the switch flips, the menu stays open
            event.preventDefault();
            void updateProfile({ hide_viewed: !viewer.hide_viewed });
          }}
        >
          <IconEyeOff />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium whitespace-nowrap">Скрыть просмотренные</span>
            <span className="type-caption text-muted-foreground">Не показывать фильмы, которые вы уже оценили</span>
          </span>
          <Switch checked={viewer.hide_viewed} tabIndex={-1} aria-hidden className="pointer-events-none" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-3 [&_svg:not([class*='size-'])]:size-[18px]">
          <Link href="/profile/accounts/">
            <IconSettings />
            Настройки
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          className="gap-3 [&_svg:not([class*='size-'])]:size-[18px]"
          onSelect={() => void logout()}
        >
          <IconLogout />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
