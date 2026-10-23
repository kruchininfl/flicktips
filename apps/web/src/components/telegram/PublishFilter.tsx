'use client';

import { useState } from 'react';

import type { VoteName } from '@flicktips/shared';

import { api } from '@/api/browser';
import { Switch } from '@/components/ui/switch';
import { VOTE_KINDS, VOTE_LABELS, VoteGlyph } from '@/components/votes/votes';

// Figma «Telegram-бот» → «Что публиковать»: which votes the bot posts to the groups. A switch saves at once and
// goes back if the request fails.
export function PublishFilter({ publish: initial }: { publish: VoteName[] }) {
  const [publish, setPublish] = useState(initial);
  const [failed, setFailed] = useState(false);

  const toggle = (kind: VoteName, on: boolean) => {
    const before = publish;
    const next = on ? [...publish, kind] : publish.filter((name) => name !== kind);
    setPublish(next);
    setFailed(false);
    api.me.telegram
      .setPublish(next)
      .then((response) => setPublish(response.publish))
      .catch(() => {
        setPublish(before);
        setFailed(true);
      });
  };

  return (
    <ul className="flex flex-col gap-2">
      {VOTE_KINDS.map((kind) => (
        <li key={kind} className="flex min-h-14 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <VoteGlyph kind={kind} size={20} />
          </span>
          <span className="flex-1 font-medium">{VOTE_LABELS[kind]}</span>
          <Switch
            checked={publish.includes(kind)}
            onCheckedChange={(on) => toggle(kind, on)}
            aria-label={`Публиковать «${VOTE_LABELS[kind]}»`}
          />
        </li>
      ))}
      {failed && <li className="type-caption text-destructive">Не получилось сохранить, попробуйте ещё раз.</li>}
    </ul>
  );
}
