'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { LoginService, LoginServices, MergeSummary as MergeSummaryData } from '@flicktips/shared';

import { isApiError } from '@/api/core';
import { api } from '@/api/browser';
import { Button } from '@/components/gui/Button';
import { signInUrl } from '@/viewer/urls';
import { useViewerActions } from '@/viewer/ViewerProvider';

import { MergeSummary, SERVICES, serviceName } from './MergeSummary';

const ACCOUNTS_URL = '/profile/accounts/';

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

function statusText(linked: boolean, isLast: boolean): string {
  if (!linked) return 'Не привязан';
  return isLast ? 'Привязан · единственный способ входа' : 'Привязан';
}

interface AccountsPanelProps {
  initialServices: LoginServices;
  // ?link_proof= / ?link_error= of the return from the provider (apps/api/docs/auth.md)
  linkProof: string | null;
  linkError: string | null;
}

// Sign-in methods of the current user: link VK / Yandex ID, unlink them, and merge in the account that
// already signs in with the one being linked.
export function AccountsPanel({ initialServices, linkProof, linkError }: AccountsPanelProps) {
  const router = useRouter();
  const { setViewer } = useViewerActions();
  const [services, setServices] = useState(initialServices);
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
    router.replace(ACCOUNTS_URL);
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
        setServices(response.services);
        setNotice({ text: serviceName(response.service) + ' привязан.' });
      })
      .catch((error) => setNotice({ error: true, text: errorText(error) }))
      .finally(() => setBusy(null));
  }, [linkProof, linkError, router]);

  const handleUnlink = (service: LoginService) => {
    if (busy) return;
    setBusy(service);
    setConflict(null);
    setNotice(null);

    api.me
      .unlinkAccount(service)
      .then((response) => {
        setServices(response.services);
        setNotice({ text: serviceName(service) + ' отвязан.' });
      })
      .catch((error) => setNotice({ error: true, text: errorText(error) }))
      .finally(() => setBusy(null));
  };

  const handleMerge = () => {
    if (!conflict || merging) return;
    setMerging(true);

    api.me
      .mergeAccount(conflict.proof)
      .then(async (response) => {
        setConflict(null);
        setServices(response.services);
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

  const linkedCount = SERVICES.filter((item) => services[item.id]).length;

  return (
    <div className="accounts">
      <div className="accounts__title">Способы входа</div>
      <div className="accounts__hint">
        Привяжите ВКонтакте и Яндекс ID, чтобы входить в этот аккаунт любым из них. Если у вас уже есть второй аккаунт
        FlickTips, его можно объединить с этим.
      </div>

      {notice ? <div className={'accounts__notice' + (notice.error ? ' m-error' : '')}>{notice.text}</div> : null}

      <ul className="accounts__list">
        {SERVICES.map((service) => {
          const linked = services[service.id];
          const isLast = linked && linkedCount < 2;

          return (
            <li key={service.id} className="accounts__item">
              <span className={'accounts__badge accounts__badge_' + service.short}>{service.label}</span>
              <span className="accounts__info">
                <span className="accounts__name">{service.name}</span>
                <span className={'accounts__status' + (linked ? ' m-linked' : '')}>{statusText(linked, isLast)}</span>
              </span>
              {linked ? (
                <Button
                  color="gray"
                  variant="border"
                  disabled={isLast || !!busy}
                  loading={busy === service.id}
                  onClick={() => !isLast && handleUnlink(service.id)}
                >
                  Отвязать
                </Button>
              ) : (
                <LinkButton service={service.id} disabled={!!busy} />
              )}
            </li>
          );
        })}
      </ul>

      {conflict ? (
        <MergeSummary
          service={conflict.service}
          merge={conflict.merge}
          merging={merging}
          onMerge={handleMerge}
          onCancel={() => setConflict(null)}
        />
      ) : null}
    </div>
  );
}

// "Привязать": a full-page trip to the provider (/auth/<service>?link=1) that comes back with ?link_proof=
function LinkButton({ service, disabled }: { service: LoginService; disabled: boolean }) {
  const [loading, setLoading] = useState(false);

  // coming back with the browser's Back button restores the page from the bfcache with the spinner on
  useEffect(() => {
    const reset = () => setLoading(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  return (
    <Button
      color="blue"
      href={disabled ? undefined : signInUrl(service, ACCOUNTS_URL, true)}
      disabled={disabled}
      loading={loading}
      onClick={() => setLoading(true)}
    >
      Привязать
    </Button>
  );
}
