import type { Metadata } from 'next';
import { cache } from 'react';

import { orNotFound, serverApi } from '@/api/server';
import { Userpic } from '@/components/gui/Userpic';
import { AcceptInviteButton } from '@/components/invite/AcceptInviteButton';
import { InviteButton } from '@/components/invite/InviteButton';
import { RememberInvite } from '@/components/invite/RememberInvite';
import { SignInButtons } from '@/components/invite/SignInButtons';
import { pageMetadata } from '@/lib/metadata';
import { getViewer } from '@/viewer/server';

const DESCRIPTION = 'Смотрите фильмы, которые рекомендуют друзья, и делитесь своими оценками.';

const getInvite = cache((code: string) => orNotFound(serverApi.invites.get(code)));

function titleOf(username: string | null): string {
  return `${username || 'Друг'} зовёт вас в FlickTips`;
}

export async function generateMetadata({ params }: PageProps<'/invite/[code]'>): Promise<Metadata> {
  const { code } = await params;
  const { user } = await getInvite(code);
  return pageMetadata({
    title: titleOf(user.username),
    description: DESCRIPTION,
    path: '/invite/' + code,
    noindex: true,
  });
}

// /invite/:code — web/src/components/InvitePage: landing page of a personal invite link
export default async function InvitePage({ params }: PageProps<'/invite/[code]'>) {
  const { code } = await params;
  const [{ user: inviter }, viewer] = await Promise.all([getInvite(code), getViewer()]);

  let actions;
  if (!viewer) {
    actions = (
      <div>
        <div className="p-invite__hint">Войдите, и вы подпишетесь друг на друга:</div>
        <SignInButtons next={'/invite/' + code} />
      </div>
    );
  } else if (inviter.id === viewer.id) {
    actions = (
      <div>
        <div className="p-invite__hint">Это ваша ссылка-приглашение. Отправьте её друзьям.</div>
        <InviteButton />
      </div>
    );
  } else {
    actions = <AcceptInviteButton code={code} />;
  }

  return (
    <div className="p-invite">
      <RememberInvite code={code} />
      <Userpic avatar={inviter.avatar} size="big" className="p-invite__pic" />
      <div className="p-invite__title">{titleOf(inviter.username)}</div>
      <div className="p-invite__text">{DESCRIPTION}</div>
      {actions}
    </div>
  );
}
