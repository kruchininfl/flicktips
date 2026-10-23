import type { Metadata } from 'next';

import { PortTodo } from '@/components/PortTodo';
import { requireViewer } from '@/viewer/server';

export const metadata: Metadata = { robots: { index: false } };

// /profile/friends/ — ProfileFriendsPage (+ ProfileLayout, UserSearch, FriendsList, SubscribeButton).
export default async function ProfileFriendsPage() {
  await requireViewer('/profile/friends/');
  return <PortTodo legacy="ProfilePage/ProfileFriendsPage" />;
}
