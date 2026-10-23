import {
  IconBookmark,
  IconBrandTelegram,
  IconHome,
  IconInfoCircle,
  IconStar,
  IconUsers,
  type Icon,
} from '@tabler/icons-react';

import type { ViewerProfile } from '@flicktips/shared';

import { plural } from '@/lib/plural';

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  // the count on the right (friend requests)
  count?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// The sidebar groups of the Figma «Сайдбар». «Сейчас в кино», «Цифровые релизы» and «Ожидаемые» join «Кино»
// when their pages exist; until then they are not shown.
export function navGroups(viewer: ViewerProfile | null): NavGroup[] {
  const groups: NavGroup[] = [{ label: 'Кино', items: [{ href: '/', label: 'Лента', icon: IconHome }] }];
  if (viewer) {
    groups.push({
      label: 'Моё',
      items: [
        { href: '/profile/bookmarks/', label: 'Закладки', icon: IconBookmark },
        { href: `/user/${viewer.id}`, label: 'Мои оценки', icon: IconStar },
        { href: '/profile/friends/', label: 'Друзья', icon: IconUsers, count: viewer.friend_requests || undefined },
      ],
    });
  }
  groups.push(
    { label: 'Сервисы', items: [{ href: '/telegram', label: 'Telegram-бот', icon: IconBrandTelegram }] },
    { label: 'Проект', items: [{ href: '/about', label: 'О проекте', icon: IconInfoCircle }] },
  );
  return groups;
}

const trim = (path: string) => path.replace(/\/+$/, '') || '/';

// the link's path or anything under it ('/' only exactly)
export function isActive(pathname: string, href: string): boolean {
  const current = trim(pathname);
  const target = trim(href);
  return target === '/' ? current === '/' : current === target || current.startsWith(target + '/');
}

// «248 оценок»
export function votesLabel(count: number): string {
  return `${count} ${plural(count, ['оценка', 'оценки', 'оценок'])}`;
}
