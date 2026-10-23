import { serverApi } from '@/api/server';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { pageMetadata } from '@/lib/metadata';
import { requireViewer } from '@/viewer/server';

export const metadata = pageMetadata({ title: 'Настройки · FlickTips', noindex: true });

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

// /profile/accounts/ — Figma «Настройки»: sign-in methods with the link / merge / unlink flow
// (apps/api/docs/auth.md, "Linking and merging accounts"), services, the profile and the account deletion.
export default async function ProfileAccountsPage({ searchParams }: PageProps<'/profile/accounts'>) {
  const viewer = await requireViewer('/profile/accounts/');
  const [{ services, avatars }, query] = await Promise.all([serverApi.me.accounts(), searchParams]);

  return (
    <SettingsPage
      viewer={viewer}
      services={services}
      avatars={avatars}
      linkProof={first(query.link_proof)}
      linkError={first(query.link_error)}
    />
  );
}
