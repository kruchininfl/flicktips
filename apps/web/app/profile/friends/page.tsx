import type { Metadata } from 'next';

import { serverApi } from '@/api/server';
import { Friends } from '@/components/profile/Friends';
import { SITE_URL } from '@/lib/config';
import { requireViewer } from '@/viewer/server';

export const metadata: Metadata = { robots: { index: false } };

// /profile/friends/ — Figma «Друзья»
export default async function ProfileFriendsPage() {
  await requireViewer('/profile/friends/');
  // recommendations and the invite link are extras: the page works without them
  const [{ friends, requests, outgoing }, recommendations, invite] = await Promise.all([
    serverApi.me.circle(),
    serverApi.me.recommendations().then(
      (response) => response.results,
      () => [],
    ),
    serverApi.me.invite().then(
      (response) => response.code,
      () => null,
    ),
  ]);

  return (
    <Friends
      initial={{ friends, requests, outgoing }}
      recommendations={recommendations}
      inviteLink={invite ? `${SITE_URL}/invite/${invite}` : null}
    />
  );
}
