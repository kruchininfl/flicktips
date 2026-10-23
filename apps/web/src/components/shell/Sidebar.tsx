'use client';

import { IconChevronRight, IconLogin } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

import { Logo, Mark } from '@/components/brand/Logo';
import { UserAvatar } from '@/components/brand/UserAvatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useViewer } from '@/viewer/ViewerProvider';

import { isActive, navGroups, votesLabel } from './nav';
import { ThemeToggle } from './ThemeToggle';
import { useUi } from './UiProvider';
import { UserMenu } from './UserMenu';

// Figma «Сайдбар» (Режим = Вошёл / Гость): the desktop sidebar and the phone/tablet menu.
export function Sidebar({ className }: { className?: string }) {
  const viewer = useViewer();
  const pathname = usePathname();
  const { openSignIn } = useUi();

  return (
    <nav aria-label="Разделы" className={cn('flex h-full flex-col overflow-y-auto bg-page', className)}>
      <div className="flex items-center justify-between py-2 pr-2 pl-3">
        <Logo />
        <ThemeToggle />
      </div>

      {navGroups(viewer).map((group) => (
        <div key={group.label} className="flex flex-col p-2">
          <div className="flex h-8 items-center px-3 type-label text-muted-foreground">{group.label}</div>
          {group.items.map(({ href, label, icon: ItemIcon, count }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-9 items-center gap-2.5 rounded-[15px] px-3 text-foreground hover:bg-muted',
                  active && 'bg-muted font-medium',
                )}
              >
                <ItemIcon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {!!count && <span className="font-mono text-[11px] leading-4 text-faint">{count}</span>}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-auto p-2">
        {viewer ? (
          <UserMenu viewer={viewer} side="top">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left hover:bg-muted data-[state=open]:bg-muted"
            >
              <UserAvatar src={viewer.avatar} name={viewer.username} size={32} />
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate font-medium">{viewer.username}</b>
                <span className="truncate type-caption text-muted-foreground">{votesLabel(viewer.votes_count)}</span>
              </span>
              <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </UserMenu>
        ) : (
          <div className="flex flex-col gap-3 rounded-[15px] border border-border bg-card p-4">
            <b className="font-semibold">Оценивайте кино вместе с друзьями</b>
            <span className="type-caption text-muted-foreground">
              Смотрите, что понравилось друзьям, и сохраняйте фильмы на потом.
            </span>
            <Button size="s" className="w-full" onClick={openSignIn}>
              Войти
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}

// Figma «Сайдбар свёрнутый»: icons only, 64px; the labels come up as tooltips.
export function CollapsedSidebar() {
  const viewer = useViewer();
  const pathname = usePathname();
  const { openSignIn } = useUi();

  return (
    <nav aria-label="Разделы" className="flex h-full flex-col items-center gap-1 overflow-y-auto bg-page px-3 pb-3">
      <Link href="/" aria-label="FlickTips" className="flex h-14 w-10 shrink-0 items-center justify-center">
        <Mark size={34} />
      </Link>
      {navGroups(viewer).map((group, index) => (
        <Fragment key={group.label}>
          {index > 0 && <Separator className="my-2 w-6!" />}
          {group.items.map(({ href, label, icon: ItemIcon, count }) => (
            <Tooltip key={href}>
              <TooltipTrigger asChild>
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={isActive(pathname, href) ? 'page' : undefined}
                  className={cn(
                    'relative flex size-10 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-muted',
                    isActive(pathname, href) && 'bg-muted',
                  )}
                >
                  <ItemIcon className="size-[18px]" />
                  {!!count && <span className="absolute top-2 right-2 size-[7px] rounded-full bg-brand" />}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ))}
        </Fragment>
      ))}
      <div className="mt-auto flex flex-col items-center gap-1">
        <ThemeToggle square />
        {viewer ? (
          <UserMenu viewer={viewer} side="right">
            <button type="button" aria-label="Меню профиля" className="flex h-11 w-10 items-center justify-center">
              <UserAvatar src={viewer.avatar} name={viewer.username} size={32} />
            </button>
          </UserMenu>
        ) : (
          <Button variant="ghost" size="icon-square" aria-label="Войти" title="Войти" onClick={openSignIn}>
            <IconLogin />
          </Button>
        )}
      </div>
    </nav>
  );
}
