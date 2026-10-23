'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';

import type { TelegramLinkResponse, TelegramResponse } from '@flicktips/shared';

import { api } from '@/api/browser';
import { Button } from '@/components/gui/Button';

import './TelegramBlock.scss';

interface State {
  status: TelegramResponse;
  links: TelegramLinkResponse;
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
    <li className={'tg-block__step' + (done ? ' m-done' : '')}>
      <span className="tg-block__step-mark">
        {done ? (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
          </svg>
        ) : (
          number
        )}
      </span>
      <div className="tg-block__step-body">
        <div className="tg-block__step-title">{title}</div>
        {children}
      </div>
    </li>
  );
}

// Own profile: link Telegram and see the groups where @FlickTipsBot posts my ratings (bot: apps/tg-bot/).
// Port of web/src/partitions/TelegramBlock; loads its data on mount.
export function TelegramBlock() {
  const [state, setState] = useState<State | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);

  // a new code each time: they live 15 minutes and are used once
  const load = useCallback(
    () =>
      Promise.all([api.me.telegram.get(), api.me.telegram.link()])
        .then(([status, links]) => setState({ status, links }))
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    void load();
    // the user links the account or joins a group in Telegram and comes back to this tab
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  if (!state) return null;

  const { linked, username, botUsername, groups } = state.status;
  const { links } = state;
  const inGroup = groups.some((group) => group.active);

  const handleLeave = (chatId: string) => {
    setLeaving(chatId);
    api.me.telegram
      .leaveGroup(chatId)
      .then(load)
      .catch(() => undefined)
      .finally(() => setLeaving(null));
  };

  const handleUnlink = () => {
    api.me.telegram
      .unlink()
      .then(load)
      .catch(() => undefined);
  };

  return (
    <div className="tg-block">
      <div className="tg-block__title">Оценки в Telegram</div>
      <div className="tg-block__text">
        Бот @{botUsername} публикует ваши оценки фильмов в группах Telegram с друзьями.
      </div>

      <ol className="tg-block__steps">
        <Step number={1} done={linked} title="Привяжите Telegram">
          {linked ? (
            <div className="tg-block__text">
              Привязан
              {username ? (
                <span>
                  {' '}
                  <b>@{username}</b>
                </span>
              ) : (
                ''
              )}
              .{' '}
              <span className="tg-block__link" onClick={handleUnlink}>
                Отвязать
              </span>
            </div>
          ) : (
            <div className="tg-block__actions">
              <Button href={links.startUrl} target="_blank" rel="noopener noreferrer" color="green">
                Привязать Telegram
              </Button>
            </div>
          )}
        </Step>
        <Step number={2} done={inGroup} title="Добавьте бота в группу">
          <div>
            <div className="tg-block__text">
              Добавленный этой кнопкой бот сразу начнёт публиковать ваши оценки. Если бот уже есть в группе, нажмите там
              «Участвовать».
            </div>
            {groups.length ? (
              <ul className="tg-block__groups">
                {groups.map((group) => (
                  <li key={group.chat_id} className="tg-block__group">
                    <span className="tg-block__group-title">
                      {group.title || 'Группа без названия'}
                      {group.active ? '' : <span className="tg-block__group-note"> · бот удалён из группы</span>}
                    </span>
                    <Button
                      color="light-gray"
                      loading={leaving === group.chat_id}
                      onClick={() => handleLeave(group.chat_id)}
                    >
                      выйти
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="tg-block__actions">
              <Button
                href={links.groupUrl}
                target="_blank"
                rel="noopener noreferrer"
                color={inGroup ? 'light-gray' : 'green'}
              >
                {inGroup ? 'Добавить в ещё одну группу' : 'Добавить бота в группу'}
              </Button>
            </div>
          </div>
        </Step>
      </ol>
    </div>
  );
}
