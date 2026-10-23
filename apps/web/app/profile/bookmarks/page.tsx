import type { Metadata } from 'next';

import { PortTodo } from '@/components/PortTodo';
import { requireViewer } from '@/viewer/server';

export const metadata: Metadata = { robots: { index: false } };

// /profile/bookmarks/ — ProfileBookmarksPage (+ ProfileLayout).
export default async function ProfileBookmarksPage() {
  await requireViewer('/profile/bookmarks/');
  return <PortTodo legacy="ProfilePage/ProfileBookmarksPage" />;
}
