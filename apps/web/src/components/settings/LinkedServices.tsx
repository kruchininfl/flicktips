'use client';

import { IconBell, IconBrandTelegram, IconChevronRight } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import type { TelegramResponse } from '@flicktips/shared';

import { api } from '@/api/browser';
import { PushToggle } from '@/components/pwa/PushToggle';
import { canUseTelegram } from '@/components/telegram/access';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { plural } from '@/lib/plural';
import { cn } from '@/lib/utils';
import { useViewer } from '@/viewer/ViewerProvider';

import { SettingsCard, SettingsRow } from './parts';

function telegramCaption(status: TelegramResponse | null, allowed: boolean): string {
  if (!allowed) return 'Скоро: бот пока в тестовом режиме';
  if (!status) return 'Бот публикует ваши оценки в группу';
  const active = status.groups.filter((group) => group.active);
  if (active.length === 1) return `Бот публикует оценки в группу «${active[0]!.title}»`;
  if (active.length)
    return `Бот публикует оценки в ${active.length} ${plural(active.length, ['группу', 'группы', 'групп'])}`;
  return status.linked ? 'Добавьте бота в группу с друзьями' : 'Не подключён';
}

// Figma «Настройки» → «Связанные сервисы». Кинопоиск and Smart TV wait for the import (stage 7); the push
// notifications of this browser are here instead.
export function LinkedServices() {
  const viewer = useViewer();
  const allowed = canUseTelegram(viewer);
  const [telegram, setTelegram] = useState<TelegramResponse | null>(null);

  useEffect(() => {
    if (!allowed) return;
    api.me.telegram
      .get()
      .then(setTelegram)
      .catch(() => undefined);
  }, [allowed]);

  const working = !!telegram?.groups.some((group) => group.active);

  return (
    <SettingsCard title="Связанные сервисы" note="Куда публиковать оценки и как узнавать об оценках друзей">
      <ul className="flex flex-col gap-2">
        <SettingsRow
          icon={<IconBrandTelegram />}
          name="Telegram"
          href="/telegram"
          caption={telegramCaption(telegram, allowed)}
          status={
            telegram ? working ? <Badge status="positive">Работает</Badge> : <Badge>Не подключён</Badge> : undefined
          }
        >
          <IconChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </SettingsRow>
        <PushToggle>
          {({ status, error, switchProps }) => (
            <SettingsRow
              icon={<IconBell />}
              name="Уведомления"
              caption={<span className={cn(error && 'text-destructive')}>{status}</span>}
            >
              <Switch {...switchProps} />
            </SettingsRow>
          )}
        </PushToggle>
      </ul>
    </SettingsCard>
  );
}
