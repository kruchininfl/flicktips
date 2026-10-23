import type { Metadata } from 'next';
import { cache } from 'react';

import { orNotFound, serverApi } from '@/api/server';
import { AuthBackdrop } from '@/components/auth/AuthBackdrop';
import { SignInCard } from '@/components/auth/SignInCard';
import { UserAvatar } from '@/components/brand/UserAvatar';
import { AcceptInviteButton } from '@/components/invite/AcceptInviteButton';
import { InviteDialogButton } from '@/components/invite/InviteDialogButton';
import { RememberInvite } from '@/components/invite/RememberInvite';
import { Badge } from '@/components/ui/badge';
import { pageMetadata } from '@/lib/metadata';
import { plural } from '@/lib/plural';
import { getViewer } from '@/viewer/server';

const DESCRIPTION = 'Смотрите фильмы, которые рекомендуют друзья, и делитесь своими оценками.';

const getInvite = cache((code: string) => orNotFound(serverApi.invites.get(code)));

function titleOf(username: string | null): string {
  return `${(username || 'Друг').split(' ')[0]} зовёт вас в FlickTips`;
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

// /invite/:code — Figma «Инвайт»: the landing page of a personal invite link
export default async function InvitePage({ params }: PageProps<'/invite/[code]'>) {
  const { code } = await params;
  const [{ user: inviter }, viewer] = await Promise.all([getInvite(code), getViewer()]);
  // the counts are an extra
  const stats = await serverApi.users.stats(inviter.id).then(
    (response) => response.stats,
    () => null,
  );
  const votes = stats ? Object.values(stats.votes).reduce((sum, n) => sum + n, 0) : 0;
  const own = !!viewer && viewer.id === inviter.id;

  return (
    <AuthBackdrop>
      <RememberInvite code={code} />
      <SignInCard
        next={'/invite/' + code}
        top={<UserAvatar src={inviter.avatar} name={inviter.username} size={96} className="size-20" />}
        title={own ? 'Это ваша ссылка-приглашение' : titleOf(inviter.username)}
        text={
          own
            ? 'Отправьте её друзьям: когда друг войдёт по ней, вы подпишетесь друг на друга.'
            : 'Оценивайте фильмы и смотрите, что понравилось друзьям. После входа вы сразу станете друзьями.'
        }
        extra={
          stats &&
          votes > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              <Badge status="accent" dot={false}>
                {votes} {plural(votes, ['оценка', 'оценки', 'оценок'])}
              </Badge>
              {stats.friends > 0 && (
                <Badge dot={false}>
                  {stats.friends} {plural(stats.friends, ['друг', 'друга', 'друзей'])}
                </Badge>
              )}
            </div>
          )
        }
        actions={
          viewer ? own ? <InviteDialogButton className="w-full" /> : <AcceptInviteButton code={code} /> : undefined
        }
      />
    </AuthBackdrop>
  );
}
