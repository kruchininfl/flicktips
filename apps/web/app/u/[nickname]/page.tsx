import { notFound, redirect } from 'next/navigation';

import { orNotFound, serverApi } from '@/api/server';

// /u/:nickname — the short link of a profile (settings → «Ник»), leads to /user/:id
export default async function NicknamePage({ params }: PageProps<'/u/[nickname]'>) {
  const { nickname } = await params;
  const clean = decodeURIComponent(nickname).toLowerCase();
  if (!/^[a-z][a-z0-9_-]{2,31}$/.test(clean)) notFound();

  const { id } = await orNotFound(serverApi.users.byNickname(clean));
  // not permanent: the nickname can change or go to someone else
  redirect(`/user/${id}`);
}
