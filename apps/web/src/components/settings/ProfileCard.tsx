'use client';

import { IconBrandVk, IconBrandYandex, IconCheck, IconPhoto, IconUserCircle } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import type { LoginService, ProfileUpdate, ViewerProfile } from '@flicktips/shared';

import { isApiError } from '@/api/core';
import { api } from '@/api/browser';
import { UserAvatar } from '@/components/brand/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SITE_URL } from '@/lib/config';
import { cn } from '@/lib/utils';
import { useViewerActions } from '@/viewer/ViewerProvider';

import { SettingsCard } from './parts';

// the same rule as the API (repositories/users.ts)
const NICKNAME_RE = /^[a-z][a-z0-9_-]{2,31}$/;

const PHOTOS: { id: LoginService; name: string; icon: typeof IconBrandVk }[] = [
  { id: 'vkontakte', name: 'Фото из VK ID', icon: IconBrandVk },
  { id: 'yandex', name: 'Фото из Яндекс ID', icon: IconBrandYandex },
];

function saveError(error: unknown): string {
  if (isApiError(error) && error.status === 409) return 'Этот ник уже занят.';
  if (isApiError(error) && error.status === 400) return 'Такой ник нельзя: попробуйте другой.';
  return 'Не получилось сохранить, попробуйте ещё раз.';
}

const field =
  'h-10 w-full rounded-md bg-input px-3 outline-none placeholder:text-faint focus-visible:ring-[3px] focus-visible:ring-brand-line aria-invalid:ring-[3px] aria-invalid:ring-destructive-line';

// Figma «Настройки» → «Профиль»: the photo (one of the linked accounts' or none), the name and the nickname of
// /u/<nickname>.
export function ProfileCard({
  viewer,
  avatars,
}: {
  viewer: ViewerProfile;
  avatars: Record<LoginService, string | null>;
}) {
  const router = useRouter();
  const { setViewer } = useViewerActions();
  const [username, setUsername] = useState(viewer.username ?? '');
  const [nickname, setNickname] = useState(viewer.nickname ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const cleanNickname = nickname.trim().toLowerCase();
  const nicknameInvalid = cleanNickname !== '' && !NICKNAME_RE.test(cleanNickname);
  const changed = username.trim() !== (viewer.username ?? '') || cleanNickname !== (viewer.nickname ?? '');

  const save = (data: ProfileUpdate, done?: string) => {
    setBusy(true);
    setMessage(null);
    return api.me
      .update(data)
      .then((response) => {
        setViewer(response.data);
        setUsername(response.data.username ?? '');
        setNickname(response.data.nickname ?? '');
        if (done) setMessage({ text: done });
        router.refresh();
      })
      .catch((error) => setMessage({ error: true, text: saveError(error) }))
      .finally(() => setBusy(false));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || nicknameInvalid || !changed || busy) return;
    void save({ username: username.trim(), nickname: cleanNickname }, 'Сохранено');
  };

  const photos = PHOTOS.filter((photo) => avatars[photo.id]);

  return (
    <SettingsCard title="Профиль">
      <div className="flex items-center gap-3">
        <UserAvatar src={viewer.avatar} name={viewer.username} size={40} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="s" disabled={busy}>
              <IconPhoto />
              Сменить фото
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {photos.map((photo) => (
              <DropdownMenuItem key={photo.id} onSelect={() => void save({ avatar: photo.id })}>
                <photo.icon />
                {photo.name}
                {viewer.avatar === avatars[photo.id] && <IconCheck className="ml-auto" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => void save({ avatar: 'none' })}>
              <IconUserCircle />
              Без фото, инициалы
              {!viewer.avatar && <IconCheck className="ml-auto" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="type-label">Имя</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={64}
            required
            autoComplete="name"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="type-label">Ник</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={32}
            placeholder="латиница, цифры, - и _"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={nicknameInvalid || undefined}
            className={field}
          />
          <span className={cn('type-caption', nicknameInvalid ? 'text-destructive' : 'text-muted-foreground')}>
            {nicknameInvalid
              ? 'От 3 до 32 знаков: латинские буквы, цифры, «-» и «_», начинается с буквы'
              : cleanNickname
                ? `Ваша ссылка: ${SITE_URL.replace(/^https?:\/\//, '')}/u/${cleanNickname}`
                : 'Короткая ссылка на ваш профиль'}
          </span>
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy || !changed || nicknameInvalid || !username.trim()}>
            Сохранить
          </Button>
          {message && (
            <span className={cn('type-caption', message.error ? 'text-destructive' : 'text-positive')}>
              {message.text}
            </span>
          )}
        </div>
      </form>
    </SettingsCard>
  );
}
