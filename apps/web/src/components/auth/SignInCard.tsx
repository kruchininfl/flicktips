import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { OAuthButton } from './OAuthButton';

// /signin?error=… codes from the API (apps/api/docs/auth.md, "Sign-in flow")
const ERRORS: Record<string, string> = {
  state: 'Вход не завершён: попробуйте ещё раз.',
  denied: 'Вход отменён.',
  provider: 'Сервис входа не ответил, попробуйте позже.',
  params: 'Вход не завершён: попробуйте ещё раз.',
};

interface SignInCardProps {
  // where to come back after signing in
  next: string;
  // above the title: the logo, or the inviter's avatar
  top: ReactNode;
  title: ReactNode;
  text: ReactNode;
  // between the text and the buttons (the inviter's counts)
  extra?: ReactNode;
  error?: string | null;
  // replaces the sign-in buttons for a signed-in visitor
  actions?: ReactNode;
  className?: string;
}

// The Figma «Вход» card: on /signin, in the sign-in popup and on an invite (with the inviter on top).
export function SignInCard({ next, top, title, text, extra, error, actions, className }: SignInCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-5 rounded-card border border-ring bg-card/85 p-6 text-center shadow-[0_2px_6px_#0000000f,0_16px_40px_#1c1a142e] backdrop-blur-xl sm:p-8',
        className,
      )}
    >
      {top}
      <div className="flex flex-col gap-1.5">
        <h1 className="type-h2">{title}</h1>
        <p className="text-muted-foreground">{text}</p>
      </div>
      {extra}
      {error && (
        <p className="w-full rounded-md border border-destructive-line px-3 py-2 type-caption text-destructive">
          {ERRORS[error] ?? ERRORS.params}
        </p>
      )}
      {actions ?? (
        <>
          <div className="flex w-full flex-col gap-2">
            <OAuthButton provider="yandex" next={next}>
              Войти с Яндекс ID
            </OAuthButton>
            <OAuthButton provider="vkontakte" next={next}>
              Войти через VK ID
            </OAuthButton>
          </div>
          <p className="type-caption text-faint">
            Продолжая, вы соглашаетесь с условиями и политикой конфиденциальности
          </p>
        </>
      )}
    </div>
  );
}
