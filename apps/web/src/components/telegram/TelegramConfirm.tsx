'use client';

import { useEffect, useRef, useState } from 'react';

import { api } from '@/api/browser';
import { Button } from '@/components/gui/Button';
import { SignInButtons } from '@/components/invite/SignInButtons';
import { rememberTelegramCode, takeRememberedTelegramCode } from '@/lib/remembered';
import { useViewer } from '@/viewer/ViewerProvider';

type Status = 'idle' | 'done' | 'error';

// The bot sends here someone who pressed «Участвовать» in a group before linking their Telegram to FlickTips.
// After sign-in the code links the account and joins that group (web/src/components/TelegramPage).
export function TelegramConfirm({ code }: { code: string }) {
  const viewer = useViewer();
  const viewerId = viewer?.id;
  const [status, setStatus] = useState<Status>('idle');
  const [group, setGroup] = useState<{ title: string } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!viewerId) {
      // the sign-in may come back on another page, PendingActions picks the code up there
      rememberTelegramCode(code);
      return;
    }
    if (started.current) return;
    started.current = true;
    takeRememberedTelegramCode();
    api.me.telegram
      .confirm(code)
      .then((response) => {
        setGroup(response.group);
        setStatus('done');
      })
      .catch(() => setStatus('error'));
  }, [viewerId, code]);

  if (!viewerId) {
    return (
      <div>
        <div className="p-invite__title">Привяжите Telegram к FlickTips</div>
        <div className="p-invite__text">Войдите, и бот начнёт публиковать ваши оценки фильмов в группе Telegram.</div>
        <SignInButtons next={'/telegram?code=' + encodeURIComponent(code)} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div>
        <div className="p-invite__title">Ссылка устарела</div>
        <div className="p-invite__text">Нажмите «Участвовать» в группе ещё раз, и бот пришлёт новую ссылку.</div>
      </div>
    );
  }

  if (status !== 'done') return null;

  return (
    <div>
      <div className="p-invite__title">Готово, Telegram привязан</div>
      <div className="p-invite__text">
        {group
          ? `Ваши оценки будут появляться в группе «${group.title}».`
          : 'Теперь нажмите «Участвовать» в группе, где есть бот.'}
      </div>
      <Button color="green" to={'/user/' + viewerId} className="p-invite__btn">
        Мой профиль
      </Button>
    </div>
  );
}
