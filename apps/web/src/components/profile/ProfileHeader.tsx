import type { ReactNode } from 'react';

import type { ProfileStats, PublicUser } from '@flicktips/shared';

import { UserAvatar } from '@/components/brand/UserAvatar';
import { yearOf } from '@/lib/dates';
import { plural } from '@/lib/plural';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="font-semibold text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

// Figma «Профиль»: the avatar, the name, «На FlickTips с 2021 года», the counts and the action on the right
// (below everything on phones).
export function ProfileHeader({
  user,
  stats,
  children,
}: {
  user: PublicUser;
  stats: ProfileStats | null;
  children?: ReactNode;
}) {
  const since = yearOf(user.registration_date);
  const votes = stats ? Object.values(stats.votes).reduce((sum, n) => sum + n, 0) : null;

  return (
    <section className="flex flex-col items-start gap-4 rounded-card border border-ring bg-card p-5 shadow-card sm:flex-row sm:items-center sm:gap-6 sm:p-6">
      <UserAvatar src={user.avatar} name={user.username} size={96} className="max-sm:size-10 max-sm:type-body" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h1 className="type-h1-mobile break-words sm:type-h1">{user.username || 'Без имени'}</h1>
        {since && <p className="text-muted-foreground">На FlickTips с {since} года</p>}
        {stats && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Stat value={votes!} label={plural(votes!, ['оценка', 'оценки', 'оценок'])} />
            <Stat value={stats.friends} label={plural(stats.friends, ['друг', 'друга', 'друзей'])} />
            {stats.bookmarks !== undefined && <Stat value={stats.bookmarks} label="в закладках" />}
          </div>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">{children}</div>}
    </section>
  );
}
