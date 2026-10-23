import { IconShare } from '@tabler/icons-react';
import { notFound } from 'next/navigation';

import { orNotFound, serverApi } from '@/api/server';
import { FollowButton } from '@/components/profile/FollowButton';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { UserVotes } from '@/components/profile/UserVotes';
import { VoteBreakdown } from '@/components/profile/VoteBreakdown';
import { ShareDialog } from '@/components/share/ShareDialog';
import { Button } from '@/components/ui/button';
import { SITE_URL } from '@/lib/config';
import { pluralGender } from '@/lib/gender';
import { getViewer } from '@/viewer/server';

// /user/:id — Figma «Мои оценки (профиль)»: the header with the counts, how the votes split, the votes by month.
export default async function UserPage({ params }: PageProps<'/user/[id]'>) {
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id)) notFound();

  const [viewer, { user }, { results }, stats] = await Promise.all([
    getViewer(),
    orNotFound(serverApi.users.get(id)),
    orNotFound(serverApi.users.votes(id)),
    // the page still works without the numbers
    serverApi.users.stats(id).then(
      (response) => response.stats,
      () => null,
    ),
  ]);
  const isMyPage = !!viewer && viewer.id === user.id;
  const name = user.username || 'Пользователь';

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader user={user} stats={stats}>
        {isMyPage ? (
          <ShareDialog
            title="Поделиться профилем"
            description="По ссылке откроется ваш профиль с оценками и статистикой."
            link={viewer.nickname ? `${SITE_URL}/u/${viewer.nickname}` : `${SITE_URL}/user/${user.id}`}
            text="Мои оценки фильмов на FlickTips"
          >
            <Button variant="outline">
              <IconShare />
              Поделиться
            </Button>
          </ShareDialog>
        ) : (
          <>
            <FollowButton userId={user.id} subscribed={!!user.subscribed} followsMe={!!user.followsMe} />
            {user.followsMe && !user.subscribed && (
              <span className="type-caption text-muted-foreground">
                {pluralGender(user.gender, ['подписан', 'подписана', 'подписан(а)'])} на вас
              </span>
            )}
          </>
        )}
      </ProfileHeader>

      {stats && (
        <VoteBreakdown
          title={isMyPage ? 'Как вы оцениваете кино' : `Как ${name.split(' ')[0]} оценивает кино`}
          votes={stats.votes}
        />
      )}

      <UserVotes user={user} isMyPage={isMyPage} votes={stats?.votes ?? null} initial={results} />
    </div>
  );
}
