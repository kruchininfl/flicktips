'use client';

// What the legacy App did once a guest had signed in: accept a remembered invite (InvitePage) and confirm a
// remembered Telegram code (TelegramPage), then open the inviter's / the user's page.
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { api } from '@/api/browser';
import { takeRememberedInvite, takeRememberedTelegramCode } from '@/lib/remembered';
import { useViewer } from '@/viewer/ViewerProvider';

export function PendingActions() {
  const viewer = useViewer();
  const pathname = usePathname();
  const router = useRouter();
  const viewerId = viewer?.id;

  useEffect(() => {
    if (!viewerId) return;

    const invite = takeRememberedInvite();
    if (invite) {
      api.me
        .acceptInvite(invite)
        .then(({ inviterId }) => {
          if (inviterId !== viewerId) router.push('/user/' + inviterId);
        })
        .catch(() => undefined);
    }

    // the Telegram page confirms its code itself
    if (pathname.startsWith('/telegram')) return;
    const code = takeRememberedTelegramCode();
    if (code) {
      api.me.telegram
        .confirm(code)
        .then(() => router.push('/user/' + viewerId))
        .catch(() => undefined);
    }
    // only when the viewer changes (signs in), not on every navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerId]);

  return null;
}
