'use client';

import { IconBrandVk, IconBrandYandex, IconLink, IconUnlink } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { LoginService, LoginServices, MergeSummary as MergeSummaryData } from '@flicktips/shared';

import { isApiError } from '@/api/core';
import { api } from '@/api/browser';
import { UserAvatar } from '@/components/brand/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { plural } from '@/lib/plural';
import { cn } from '@/lib/utils';
import { signInUrl } from '@/viewer/urls';
import { useViewerActions } from '@/viewer/ViewerProvider';

import { SettingsCard, SettingsRow } from './parts';

export const SETTINGS_URL = '/profile/accounts/';

export const SERVICES: { id: LoginService; name: string; icon: typeof IconBrandVk }[] = [
  { id: 'yandex', name: 'Яндекс ID', icon: IconBrandYandex },
  { id: 'vkontakte', name: 'VK ID', icon: IconBrandVk },
];

export const serviceName = (id: LoginService) => SERVICES.find((service) => service.id === id)!.name;

interface Notice {
  text: string;
  error?: boolean;
}

interface Conflict {
  proof: string;
  service: LoginService;
  merge: MergeSummaryData;
}

function errorText(error: unknown): string {
  if (isApiError(error) && error.body?.msg === 'sign-in expired, try again') return 'Вход устарел, попробуйте ещё раз.';
  return 'Что-то пошло не так, попробуйте ещё раз.';
}

// ?link_error= from the API: the provider round trip did not complete
function linkErrorText(code: string): string {
  if (code === 'denied') return 'Привязка отменена.';
  if (code === 'state' || code === 'session') return 'Вход устарел, попробуйте ещё раз.';
  return 'Что-то пошло не так, попробуйте ещё раз.';
}

interface SignInMethodsProps {
  services: LoginServices;
  onServicesChange: (services: LoginServices) => void;
  // ?link_proof= / ?link_error= of the return from the provider (apps/api/docs/auth.md)
  linkProof: string | null;
  linkError: string | null;
}

// Figma «Настройки» → «Способы входа»: link VK / Yandex ID, unlink them, and merge in the account that already
// signs in with the one being linked.
export function SignInMethods({ services, onServicesChange, linkProof, linkError }: SignInMethodsProps) {
  const router = useRouter();
  const { setViewer } = useViewerActions();
  const [busy, setBusy] = useState<LoginService | 'link' | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [merging, setMerging] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(
    linkError ? { error: true, text: linkErrorText(linkError) } : null,
  );
  // a proof is used once, even though the effect runs twice in development
  const handledProof = useRef<string | null>(null);

  useEffect(() => {
    if (!linkProof && !linkError) return;
    // the proof and the error do not belong in the URL after they are read
    router.replace(SETTINGS_URL);
    if (!linkProof || handledProof.current === linkProof) return;
    handledProof.current = linkProof;

    setBusy('link');
    api.me
      .linkAccount(linkProof)
      .then((response) => {
        if (response.status === 'conflict') {
          setConflict({ proof: linkProof, service: response.service, merge: response.merge });
          return;
        }
        onServicesChange(response.services);
        setNotice({ text: serviceName(response.service) + ' привязан.' });
      })
      .catch((error) => setNotice({ error: true, text: errorText(error) }))
      .finally(() => setBusy(null));
  }, [linkProof, linkError, router, onServicesChange]);

  const unlink = (service: LoginService) => {
    if (busy) return;
    setBusy(service);
    setNotice(null);
    api.me
      .unlinkAccount(service)
      .then((response) => {
        onServicesChange(response.services);
        setNotice({ text: serviceName(service) + ' отвязан.' });
      })
      .catch((error) => setNotice({ error: true, text: errorText(error) }))
      .finally(() => setBusy(null));
  };

  const merge = () => {
    if (!conflict || merging) return;
    setMerging(true);
    api.me
      .mergeAccount(conflict.proof)
      .then(async (response) => {
        setConflict(null);
        onServicesChange(response.services);
        setNotice({ text: 'Аккаунты объединены: оценки, закладки и подписки теперь здесь.' });
        // the profile may have taken the avatar of the merged account
        await api.me.get().then((me) => setViewer(me.data));
        router.refresh();
      })
      .catch((error) => {
        setConflict(null);
        setNotice({ error: true, text: errorText(error) });
      })
      .finally(() => setMerging(false));
  };

  const linkedCount = SERVICES.filter((service) => services[service.id]).length;

  return (
    <SettingsCard title="Способы входа" note="Входите в FlickTips любым привязанным аккаунтом">
      {notice && (
        <p className={cn('-mt-1 type-caption', notice.error ? 'text-destructive' : 'text-positive')}>{notice.text}</p>
      )}
      <ul className="flex flex-col gap-2">
        {SERVICES.map((service) => {
          const linked = services[service.id];
          const last = linked && linkedCount < 2;
          return (
            <SettingsRow
              key={service.id}
              icon={<service.icon />}
              name={service.name}
              caption={linked ? (last ? 'Единственный способ входа' : 'Привязан') : 'Не привязан'}
              status={linked ? <Badge status="positive">Подключён</Badge> : undefined}
            >
              {linked ? (
                <Button
                  variant="ghost"
                  size="s"
                  disabled={last || !!busy}
                  title={last ? 'Нельзя отвязать единственный способ входа' : undefined}
                  onClick={() => unlink(service.id)}
                >
                  <IconUnlink />
                  Отвязать
                </Button>
              ) : (
                <LinkButton service={service.id} disabled={!!busy} />
              )}
            </SettingsRow>
          );
        })}
      </ul>

      <Dialog open={!!conflict} onOpenChange={(open) => !open && !merging && setConflict(null)}>
        {conflict && (
          <MergeDialog service={conflict.service} merge={conflict.merge} merging={merging} onMerge={merge} />
        )}
      </Dialog>
    </SettingsCard>
  );
}

// «Привязать»: a full-page trip to the provider (/auth/<service>?link=1) that comes back with ?link_proof=
function LinkButton({ service, disabled }: { service: LoginService; disabled: boolean }) {
  const [loading, setLoading] = useState(false);

  // coming back with the browser's Back button restores the page from the bfcache with the spinner on
  useEffect(() => {
    const reset = () => setLoading(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  if (disabled || loading) {
    return (
      <Button variant="outline" size="s" disabled>
        <IconLink />
        Привязать
      </Button>
    );
  }
  return (
    <Button variant="outline" size="s" asChild>
      <a href={signInUrl(service, SETTINGS_URL, true)} onClick={() => setLoading(true)}>
        <IconLink />
        Привязать
      </a>
    </Button>
  );
}

const count = (n: number, forms: [string, string, string]) => `${n} ${plural(n, forms)}`;

// The account that already signs in with the service being linked, and what merging it would move over.
function MergeDialog({
  service,
  merge,
  merging,
  onMerge,
}: {
  service: LoginService;
  merge: MergeSummaryData;
  merging: boolean;
  onMerge: () => void;
}) {
  const other = merge.user;
  const name = other?.username || 'Без имени';
  const blocked = merge.blocking.length > 0;

  return (
    <DialogContent className="flex max-w-[480px] flex-col gap-4">
      <DialogTitle className="pr-8 type-h3">{serviceName(service)} уже входит в другой аккаунт FlickTips</DialogTitle>
      <div className="flex items-center gap-3">
        <UserAvatar src={other?.avatar} name={name} size={40} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{name}</span>
          <span className="type-caption text-muted-foreground">
            {count(merge.votes, ['оценка', 'оценки', 'оценок'])} ·{' '}
            {count(merge.bookmarks, ['закладка', 'закладки', 'закладок'])} ·{' '}
            {count(merge.following, ['подписка', 'подписки', 'подписок'])}
          </span>
        </div>
      </div>
      <DialogDescription className="text-muted-foreground">
        {blocked
          ? `Объединить не получится: к обоим аккаунтам привязаны разные профили ${merge.blocking.map(serviceName).join(' и ')}.`
          : `Объединить аккаунты? Оценки, закладки и подписки перейдут в этот аккаунт, а «${name}» будет удалён. Входить можно будет любым из способов.` +
            (merge.conflicts
              ? ` ${count(merge.conflicts, ['фильм оценён', 'фильма оценены', 'фильмов оценены'])} в обоих аккаунтах по-разному: останется более свежая оценка.`
              : '')}
      </DialogDescription>
      {!blocked && (
        <Button variant="primary" className="self-start" disabled={merging} onClick={onMerge}>
          Объединить
        </Button>
      )}
    </DialogContent>
  );
}
