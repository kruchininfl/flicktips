import { notFound } from 'next/navigation';

import { orNotFound, serverApi } from '@/api/server';
import { OwnProfileLinks } from '@/components/profile/OwnProfileLinks';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { ProfileVotes } from '@/components/profile/ProfileVotes';
import { SubscribeButton } from '@/components/profile/SubscribeButton';
import { pluralGender } from '@/lib/gender';
import { getViewer } from '@/viewer/server';

// the page is rendered per request, so this is the request time
const serverNow = () => Date.now();

// /user/:id — web/src/components/ProfilePage/ProfilePage: a user's votes, follow button, own links.
export default async function UserPage({ params }: PageProps<'/user/[id]'>) {
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id)) notFound();

  const [viewer, { user }, { results }] = await Promise.all([
    getViewer(),
    orNotFound(serverApi.users.get(id)),
    orNotFound(serverApi.users.votes(id)),
  ]);
  const isMyPage = !!viewer && viewer.id === user.id;

  return (
    <div className="profile">
      <ProfileLayout user={user} />

      {isMyPage ? (
        <OwnProfileLinks />
      ) : (
        <div className="profile__relation">
          <SubscribeButton userId={user.id} subscribed={!!user.subscribed} />
          {user.followsMe ? (
            <div className="profile__relation-note">
              {pluralGender(user.gender, ['подписан', 'подписана', 'подписан(а)'])} на вас
            </div>
          ) : null}
        </div>
      )}

      <ProfileVotes
        userId={user.id}
        username={user.username}
        gender={user.gender}
        isMyPage={isMyPage}
        initial={results}
        now={serverNow()}
      />
    </div>
  );
}
