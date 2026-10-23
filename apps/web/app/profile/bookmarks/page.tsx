import type { Metadata } from 'next';

import { serverApi } from '@/api/server';
import { BookmarksList } from '@/components/profile/BookmarksList';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { requireViewer } from '@/viewer/server';

export const metadata: Metadata = { robots: { index: false } };

// /profile/bookmarks/ — web/src/components/ProfilePage/ProfileBookmarksPage
export default async function ProfileBookmarksPage() {
  const viewer = await requireViewer('/profile/bookmarks/');
  const { results } = await serverApi.me.bookmarks();

  return (
    <div className="profile">
      <ProfileLayout user={viewer} />
      <BookmarksList initial={results} />
    </div>
  );
}
