import type { ReactNode } from 'react';

import type { PublicUser } from '@flicktips/shared';

import { Userpic } from '@/components/gui/Userpic';

// The avatar and the name above every profile page.
export function ProfileLayout({
  user,
  children,
}: {
  user: Pick<PublicUser, 'avatar' | 'username'>;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="profile__user">
        <Userpic avatar={user.avatar} size="big" className="profile__user-photo" />
        {user.username ? <div className="profile__user-name">{user.username}</div> : null}
      </div>

      {children}
    </div>
  );
}
