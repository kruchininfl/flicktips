'use client';

import { IconTrash } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api } from '@/api/browser';
import { forgetBrowserPush } from '@/components/pwa/push-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useViewerActions } from '@/viewer/ViewerProvider';

import { SettingsCard } from './parts';

// Figma «Настройки» → «Удаление аккаунта», with a confirmation: there is no undo.
export function DeleteAccount() {
  const router = useRouter();
  const { setViewer } = useViewerActions();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const remove = () => {
    setBusy(true);
    setFailed(false);
    api.me
      .delete()
      .then(() => {
        void forgetBrowserPush();
        setViewer(null);
        router.replace('/');
        router.refresh();
      })
      .catch(() => {
        setFailed(true);
        setBusy(false);
      });
  };

  return (
    <SettingsCard
      title="Удаление аккаунта"
      note="Оценки, закладки и друзья будут удалены без возможности восстановления."
    >
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="s" className="self-start text-destructive">
            <IconTrash />
            Удалить аккаунт
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-w-[440px] flex-col gap-4">
          <DialogTitle className="pr-8 type-h3">Удалить аккаунт навсегда?</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Все ваши оценки, закладки, подписки и подключения Telegram удалятся сразу, восстановить их не получится.
            Друзья перестанут видеть вас в FlickTips.
          </DialogDescription>
          {failed && <p className="type-caption text-destructive">Не получилось удалить, попробуйте ещё раз.</p>}
          <Button variant="destructive" className="self-start" disabled={busy} onClick={remove}>
            <IconTrash />
            Удалить навсегда
          </Button>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  );
}
