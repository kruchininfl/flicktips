import type { Metadata } from 'next';

import { serverApi } from '@/api/server';
import { AccountsPanel } from '@/components/profile/AccountsPanel';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { requireViewer } from '@/viewer/server';

export const metadata: Metadata = { robots: { index: false } };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

// /profile/accounts/ — web/src/components/ProfilePage/ProfileAccountsPage: linked sign-in methods and the
// link / merge / unlink flow (apps/api/docs/auth.md, "Linking and merging accounts").
export default async function ProfileAccountsPage({ searchParams }: PageProps<'/profile/accounts'>) {
  const viewer = await requireViewer('/profile/accounts/');
  const [{ services }, query] = await Promise.all([serverApi.me.accounts(), searchParams]);

  return (
    <div className="profile">
      <ProfileLayout user={viewer} />
      <AccountsPanel
        initialServices={services}
        linkProof={first(query.link_proof)}
        linkError={first(query.link_error)}
      />
    </div>
  );
}
