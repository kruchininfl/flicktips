import { redirect } from 'next/navigation';

import { AuthBackdrop } from '@/components/auth/AuthBackdrop';
import { SignInCard } from '@/components/auth/SignInCard';
import { Logo } from '@/components/brand/Logo';
import { pageMetadata } from '@/lib/metadata';
import { getViewer } from '@/viewer/server';
import { safeNext } from '@/viewer/urls';

export const metadata = pageMetadata({ title: 'Вход — FlickTips', path: '/signin', noindex: true });

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// /signin?next=/path&error=code — Figma «Вход». The API sends failed sign-ins here (apps/api/docs/auth.md);
// requireViewer() sends guests here from the /profile/* pages.
export default async function SignInPage({ searchParams }: PageProps<'/signin'>) {
  const query = await searchParams;
  const next = safeNext(first(query.next));
  if (await getViewer()) redirect(next);

  return (
    <AuthBackdrop>
      <SignInCard
        next={next}
        top={<Logo />}
        title="Вход в FlickTips"
        text="Оценивайте фильмы и смотрите, что понравилось друзьям"
        error={first(query.error) ?? null}
      />
    </AuthBackdrop>
  );
}
