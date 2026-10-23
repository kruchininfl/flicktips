'use client';

import { IconUserPlus } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { api } from '@/api/browser';
import { ShareDialog } from '@/components/share/ShareDialog';
import { Button } from '@/components/ui/button';
import { SITE_URL } from '@/lib/config';
import { useViewer } from '@/viewer/ViewerProvider';

// the viewer's own invite code, loaded once per page load
let cached: { viewerId: number; code: string } | null = null;

// «Пригласить друзей»: the viewer's personal invite link in the share dialog. Nothing for guests.
export function InviteDialogButton({ className }: { className?: string }) {
  const viewer = useViewer();
  const viewerId = viewer?.id;
  const [code, setCode] = useState(() => (cached && cached.viewerId === viewerId ? cached.code : null));

  useEffect(() => {
    if (!viewerId || code) return;
    api.me
      .invite()
      .then((response) => {
        cached = { viewerId, code: response.code };
        setCode(response.code);
      })
      .catch(() => undefined);
  }, [viewerId, code]);

  if (!viewerId || !code) return null;
  return (
    <ShareDialog
      title="Пригласите друзей"
      description="Отправьте личную ссылку — когда друг войдёт по ней, вы подпишетесь друг на друга."
      link={`${SITE_URL}/invite/${code}`}
      text="Делюсь оценками фильмов на FlickTips — подписывайся!"
    >
      <Button className={className}>
        <IconUserPlus />
        Пригласить друзей
      </Button>
    </ShareDialog>
  );
}
