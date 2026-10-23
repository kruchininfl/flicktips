import type { Metadata } from 'next';

import { PortTodo } from '@/components/PortTodo';
import { requireViewer } from '@/viewer/server';

export const metadata: Metadata = { robots: { index: false } };

// /profile/accounts/ — ProfileAccountsPage: linked sign-in methods, link/merge flow (apps/api/docs/auth.md,
// "Linking and merging accounts"); OAuthButton has a `link` prop for /auth/<service>?link=1.
export default async function ProfileAccountsPage() {
  await requireViewer('/profile/accounts/');
  return <PortTodo legacy="ProfilePage/ProfileAccountsPage" />;
}
