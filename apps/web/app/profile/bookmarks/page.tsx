import type { Metadata } from 'next';

import { serverApi } from '@/api/server';
import { Bookmarks } from '@/components/profile/Bookmarks';
import { requireViewer } from '@/viewer/server';

export const metadata: Metadata = { robots: { index: false } };

// /profile/bookmarks/ — Figma «Закладки»
export default async function ProfileBookmarksPage() {
  await requireViewer('/profile/bookmarks/');
  const { results } = await serverApi.me.bookmarks();

  return <Bookmarks initial={results} />;
}
