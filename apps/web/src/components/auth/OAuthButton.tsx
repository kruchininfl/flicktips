'use client';

import { IconBrandVk, IconBrandYandex, IconLoader2 } from '@tabler/icons-react';
import { useEffect, useState, type ReactNode } from 'react';

import type { LoginService } from '@flicktips/shared';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { signInUrl } from '@/viewer/urls';

const ICONS = { vkontakte: IconBrandVk, yandex: IconBrandYandex };

interface OAuthButtonProps {
  provider: LoginService;
  // where the API sends the browser back after signing in
  next: string;
  className?: string;
  children: ReactNode;
}

// A sign-in button: a plain link to /auth/<provider>?next=… (the OAuth flow needs a full-page navigation).
// Яндекс is the primary button of the Figma «Вход», VK the outlined one.
export function OAuthButton({ provider, next, className, children }: OAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const ProviderIcon = loading ? IconLoader2 : ICONS[provider];

  // coming back with the browser's Back button restores the page from the bfcache with the spinner on
  useEffect(() => {
    const reset = () => setLoading(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  return (
    <Button variant={provider === 'yandex' ? 'primary' : 'outline'} className={cn('w-full', className)} asChild>
      <a href={signInUrl(provider, next)} onClick={() => setLoading(true)} aria-busy={loading}>
        <ProviderIcon className={cn(loading && 'animate-spin')} />
        {children}
      </a>
    </Button>
  );
}
