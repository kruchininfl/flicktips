'use client';

import { IconBrandTelegram, IconCheck, IconUnlink, IconUsers, IconUsersPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type { TelegramConfirmResponse, TelegramLinkResponse, TelegramResponse } from '@flicktips/shared';

import { api } from '@/api/browser';
import { useUi } from '@/components/shell/UiProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { rememberTelegramCode, takeRememberedTelegramCode } from '@/lib/remembered';
import { plural } from '@/lib/plural';
import { cn } from '@/lib/utils';
import { useViewer } from '@/viewer/ViewerProvider';

import { canUseTelegram } from './access';
import { PublishFilter } from './PublishFilter';

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-card border border-ring bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="type-h3">{title}</h2>
        {note && <p className="type-caption text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

// a done step shows a check instead of its number; the steps can be done in any order
function Step({
  number,
  done,
  title,
  children,
}: {
  number: number;
  done: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full type-caption font-medium',
          done ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {done ? <IconCheck className="size-4" /> : number}
      </span>
      <div className="flex min-w-0 flex-col items-start gap-1 pt-0.5">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

// ?code= from the bot: someone pressed «Участвовать» in a group before linking Telegram. The code links the
// account and joins that group; guests sign in first (PendingActions finishes it on any page).
function Confirm({ code, onDone }: { code: string; onDone: () => void }) {
  const viewer = useViewer();
  const { openSignIn } = useUi();
  const [result, setResult] = useState<TelegramConfirmResponse | 'error' | null>(null);
  const started = useRef(false);
  const viewerId = viewer?.id;

  useEffect(() => {
    if (!viewerId) {
      rememberTelegramCode(code);
      return;
    }
    if (started.current) return;
    started.current = true;
    takeRememberedTelegramCode();
    api.me.telegram
      .confirm(code)
      .then((response) => {
        setResult(response);
        onDone();
      })
      .catch(() => setResult('error'));
  }, [viewerId, code, onDone]);

  if (!viewerId) {
    return (
      <Card title="Привяжите Telegram к FlickTips">
        <p className="-mt-3 text-muted-foreground">
          Войдите, и бот начнёт публиковать ваши оценки фильмов в группе Telegram.
        </p>
        <Button variant="brand" className="self-start" onClick={openSignIn}>
          Войти
        </Button>
      </Card>
    );
  }
  if (!result) return null;
  if (result === 'error') {
    return (
      <Card title="Ссылка устарела">
        <p className="-mt-3 text-muted-foreground">
          Нажмите «Участвовать» в группе ещё раз, и бот пришлёт новую ссылку.
        </p>
      </Card>
    );
  }
  return (
    <Card title="Готово, Telegram привязан">
      <p className="-mt-3 text-muted-foreground">
        {result.group
          ? `Ваши оценки будут появляться в группе «${result.group.title}».`
          : 'Теперь нажмите «Участвовать» в группе, где есть бот.'}
      </p>
    </Card>
  );
}

interface State {
  status: TelegramResponse;
  links: TelegramLinkResponse;
}

// Figma «Telegram-бот»: @FlickTipsBot posts the user's votes to Telegram groups (bot: apps/tg-bot/). Link the
// account, add the bot to a group, see and leave the groups.
export function TelegramPage({ code }: { code: string }) {
  const viewer = useViewer();
  const { openSignIn } = useUi();
  const [state, setState] = useState<State | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const allowed = canUseTelegram(viewer);

  // a new link code each time: they live 15 minutes and are used once
  const load = useCallback(
    () =>
      Promise.all([api.me.telegram.get(), api.me.telegram.link()])
        .then(([status, links]) => setState({ status, links }))
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    if (!allowed) return;
    void load();
    // the user links the account or adds the bot in Telegram and comes back to this tab
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [allowed, load]);

  const groups = state?.status.groups ?? [];
  const active = groups.filter((group) => group.active).length;
  const linked = !!state?.status.linked;

  const leave = (chatId: string) => {
    setLeaving(chatId);
    api.me.telegram
      .leaveGroup(chatId)
      .then(load)
      .catch(() => undefined)
      .finally(() => setLeaving(null));
  };

  const unlink = () => {
    api.me.telegram
      .unlink()
      .then(load)
      .catch(() => undefined);
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="type-h1-mobile sm:type-h1">Telegram-бот</h1>
          <p className="text-muted-foreground">Бот публикует ваши оценки в групповой чат, где сидят друзья</p>
        </div>
        {state &&
          (active ? (
            <Badge status="positive">
              Подключён к {active} {plural(active, ['группе', 'группам', 'группам'])}
            </Badge>
          ) : (
            <Badge>Не подключён</Badge>
          ))}
      </header>

      {code && <Confirm code={code} onDone={load} />}

      {!viewer && !code && (
        <Card title="Оценки в Telegram">
          <p className="-mt-3 text-muted-foreground">
            Войдите, чтобы подключить бота: он будет публиковать ваши оценки фильмов в группе с друзьями.
          </p>
          <Button variant="brand" className="self-start" onClick={openSignIn}>
            Войти
          </Button>
        </Card>
      )}

      {viewer && !allowed && (
        <Card title="Скоро">
          <p className="-mt-3 text-muted-foreground">
            Бот пока работает в тестовом режиме. Когда он станет доступен всем, подключить его можно будет здесь.
          </p>
          <Button variant="outline" className="self-start" asChild>
            <Link href="/">В ленту</Link>
          </Button>
        </Card>
      )}

      {state && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,740px)_340px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card title="Как подключить" note="Три шага, займёт минуту">
              <ol className="flex flex-col gap-6">
                <Step number={1} done={linked} title="Привяжите Telegram">
                  {linked ? (
                    <p className="type-caption text-muted-foreground">
                      Привязан{state.status.username ? ` @${state.status.username}` : ''} ·{' '}
                      <button type="button" className="underline hover:text-foreground" onClick={unlink}>
                        Отвязать
                      </button>
                    </p>
                  ) : (
                    <>
                      <p className="type-caption text-muted-foreground">
                        @{state.status.botUsername} спросит подтверждение в личных сообщениях
                      </p>
                      <Button variant="brand" size="s" className="mt-2" asChild>
                        <a href={state.links.startUrl} target="_blank" rel="noopener noreferrer">
                          <IconBrandTelegram />
                          Открыть в Telegram
                        </a>
                      </Button>
                    </>
                  )}
                </Step>
                <Step number={2} done={active > 0} title="Добавьте бота в группу">
                  <p className="type-caption text-muted-foreground">
                    @{state.status.botUsername} должен быть участником группового чата. Если бот уже в группе, нажмите
                    там «Участвовать»
                  </p>
                  <Button variant={active ? 'outline' : 'brand'} size="s" className="mt-2" asChild>
                    <a href={state.links.groupUrl} target="_blank" rel="noopener noreferrer">
                      <IconUsersPlus />
                      {active ? 'Добавить в ещё одну группу' : 'Добавить бота в группу'}
                    </a>
                  </Button>
                </Step>
                <Step number={3} done={linked && active > 0} title="Готово">
                  <p className="type-caption text-muted-foreground">
                    Новые оценки будут появляться в группе автоматически
                  </p>
                </Step>
              </ol>
            </Card>

            {groups.length > 0 && (
              <Card title="Подключённые группы">
                <ul className="flex flex-col gap-3">
                  {groups.map((group) => (
                    <li key={group.chat_id} className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-tint text-brand-text">
                        <IconUsers className="size-5" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                        <span className="truncate font-medium">{group.title || 'Группа без названия'}</span>
                        {group.active ? (
                          <Badge status="positive">Активна</Badge>
                        ) : (
                          <Badge status="warning">Бот удалён из группы</Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="s"
                        disabled={leaving === group.chat_id}
                        onClick={() => leave(group.chat_id)}
                      >
                        <IconUnlink />
                        Отключить
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <Card title="Что публиковать" note="Какие оценки бот отправит в группу">
            <div className="-mt-1">
              <PublishFilter publish={state.status.publish} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
