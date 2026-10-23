import Link from 'next/link';

import type { PublicUser } from '@flicktips/shared';

import { Userpic } from '@/components/gui/Userpic';

import { SubscribeButton } from './SubscribeButton';

export type FriendsListUser = PublicUser & { subscribed: boolean; reason?: string; reason_count?: number };

// why a recommended user is suggested (see UserRepository::getRecommendations)
function getReasonText(user: FriendsListUser): string {
  if (user.reason === 'friends') return 'Общие друзья: ' + user.reason_count;
  if (user.reason === 'votes') return 'Похожие оценки: ' + user.reason_count;
  return '';
}

// Grid of users with a follow button each (friends page tabs, people search, recommendations)
export function FriendsList({ users }: { users: FriendsListUser[] }) {
  return (
    <div className="profile__friends">
      {users.map((user) => (
        <div className="friend" key={user.id}>
          <Link className="link" href={'/user/' + user.id}>
            <Userpic avatar={user.avatar} size="big" className="friend__pic" />

            <div className="friend__name">{user.username}</div>
          </Link>

          {getReasonText(user) ? <div className="friend__reason">{getReasonText(user)}</div> : null}

          <div className="friend__button">
            <SubscribeButton userId={user.id} subscribed={!!user.subscribed} />
          </div>
        </div>
      ))}
    </div>
  );
}
