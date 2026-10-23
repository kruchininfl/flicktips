'use client';

import { useEffect, useState, type ReactNode } from 'react';

import type { LoginService } from '@flicktips/shared';

import { Button } from '@/components/gui/Button';
import { signInUrl } from '@/viewer/urls';

const CLASS_ALIASES: Record<LoginService, 'vk' | 'ya'> = { vkontakte: 'vk', yandex: 'ya' };

interface OAuthButtonProps {
  provider: LoginService;
  // where the API sends the browser back after signing in
  next: string;
  // link the account to the signed-in user instead of signing in (profile accounts page)
  link?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

// A sign-in button: a plain link to /auth/<provider>?next=… (the OAuth flow needs a full-page navigation).
export function OAuthButton({ provider, next, link = false, disabled = false, className, children }: OAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const alias = CLASS_ALIASES[provider];

  // coming back with the browser's Back button restores the page from the bfcache with the spinner on
  useEffect(() => {
    const reset = () => setLoading(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  return (
    <Button
      href={disabled ? undefined : signInUrl(provider, next, link)}
      loading={loading}
      disabled={disabled}
      onClick={() => setLoading(true)}
      className={`p-signin__btn p-signin__btn_${alias}${className ? ' ' + className : ''}`}
      icn={`soc_${alias}`}
    >
      {children}
    </Button>
  );
}
