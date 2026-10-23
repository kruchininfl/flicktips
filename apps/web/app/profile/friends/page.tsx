import type { Metadata } from 'next';
import Link from 'next/link';

import { serverApi } from '@/api/server';
import { InviteButton } from '@/components/invite/InviteButton';
import { FriendsList } from '@/components/profile/FriendsList';
import { FriendsPaged } from '@/components/profile/FriendsPaged';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { UserSearch } from '@/components/profile/UserSearch';
import { requireViewer } from '@/viewer/server';

export const metadata: Metadata = { robots: { index: false } };

const TABS = [
  { type: 'following', title: 'Подписки' },
  { type: 'followers', title: 'Подписчики' },
  { type: 'find', title: 'Найти друзей' },
] as const;

type Tab = (typeof TABS)[number]['type'];

const EMPTY_TEXTS = {
  following: 'Вы пока ни на кого не подписаны',
  followers: 'На вас пока никто не подписан',
};

const FRIENDS_URL = '/profile/friends/';

// the tab lives in the URL (?tab=followers / ?tab=find) so it survives reloads and can be linked to
const tabUrl = (type: Tab) => (type === 'following' ? FRIENDS_URL : `${FRIENDS_URL}?tab=${type}`);

// /profile/friends/ — web/src/components/ProfilePage/ProfileFriendsPage: following, followers, find friends.
export default async function ProfileFriendsPage({ searchParams }: PageProps<'/profile/friends'>) {
  const viewer = await requireViewer(FRIENDS_URL);
  const { tab } = await searchParams;
  const listType: Tab = tab === 'find' ? 'find' : tab === 'followers' ? 'followers' : 'following';

  const renderBody = async () => {
    if (listType === 'find') {
      // a failed recommendations request is an empty list, as before
      const recommendations = await serverApi.me.recommendations().then(
        (response) => response.results,
        () => [],
      );

      return (
        <div>
          <UserSearch />

          <div className="profile__section-title">Рекомендации</div>
          {recommendations.length ? (
            <FriendsList users={recommendations} />
          ) : (
            <div className="profile__section-empty">Пока некого порекомендовать</div>
          )}
        </div>
      );
    }

    const { results } = await serverApi.me.friends({ type: listType });
    if (!results.total) {
      return (
        <div className="page-ph">
          <div className="page-ph__icn">
            {/* eslint-disable-next-line @next/next/no-img-element -- the legacy markup */}
            <img className="icn-forever-alone" src="/public/img/forever-alone.svg" alt="" />
          </div>
          <div className="page-ph__text">
            {EMPTY_TEXTS[listType]}.<br />
            <Link className="link" href={tabUrl('find')}>
              Найти друзей
            </Link>
            {listType === 'following' ? (
              <span>
                {' '}
                или <InviteButton linkText="пригласить друзей" />
              </span>
            ) : null}
          </div>
        </div>
      );
    }
    // a new key per tab: the loaded pages of one tab must not leak into another
    return <FriendsPaged key={listType} type={listType} initial={results} />;
  };

  return (
    <div className="profile">
      <ProfileLayout user={viewer} />

      <div className="profile__tabs">
        {TABS.map((item) => (
          <Link
            key={item.type}
            href={tabUrl(item.type)}
            className={'profile__tab' + (item.type === listType ? ' m-active' : '')}
          >
            {item.title}
          </Link>
        ))}
      </div>
      {await renderBody()}
    </div>
  );
}
